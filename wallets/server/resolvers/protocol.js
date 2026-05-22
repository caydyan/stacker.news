import { GqlAuthenticationError, GqlInputError } from '@/lib/error'
import { validateSchema } from '@/lib/validate'
import protocols from '@/wallets/lib/protocols'
import { isEncryptedField, protocolRelationName, protocolServerSchema, reverseProtocolRelationName } from '@/wallets/lib/util'
import { mapWalletResolveTypes } from '@/wallets/server/resolvers/util'
import { protocolTestCreateInvoice } from '@/wallets/server/protocols'
import { timeoutSignal, withTimeout } from '@/lib/time'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from '@/lib/constants'
import { notifyNewStreak, notifyStreakLost } from '@/lib/webPush'
import { decodeCursor, LIMIT, nextCursorEncoded } from '@/lib/cursor'
import { walletLogger } from '@/wallets/server/logger'
import { WalletValidationError } from '@/wallets/client/errors'
import assertApiKeyNotPermitted from '@/api/resolvers/apiKey'

const WalletProtocolConfig = {
  __resolveType: config => config.__resolveType
}

export const resolvers = {
  WalletProtocolConfig,
  Query: {
    walletLogs
  },
  Mutation: {
    addWalletLog,
    saveWalletProtocols,
    testWalletRecvProtocol,
    deleteWalletLogs
  }
}

// Probe a receive protocol by asking it to mint a small invoice. The
// `WalletRecvProtocolTestInput` @oneOf wrapper guarantees exactly one branch
// is set and the schema only lists recv branches, so we just decode the
// relation name to identify the protocol and forward the plaintext config.
export async function testWalletRecvProtocol (parent, { config: wrapper }, { me }) {
  if (!me) throw new GqlAuthenticationError()

  const [relationName, args] = Object.entries(wrapper)[0]
  const protocol = reverseProtocolRelationName(relationName)
  if (!protocol || protocol.send) {
    throw new GqlInputError(`unknown receive protocol: ${relationName}`)
  }

  let invoice
  try {
    invoice = await withTimeout(
      protocolTestCreateInvoice(
        protocol,
        args,
        { signal: timeoutSignal(WALLET_CREATE_INVOICE_TIMEOUT_MS) }
      ),
      WALLET_CREATE_INVOICE_TIMEOUT_MS
    )
  } catch (e) {
    if (e instanceof WalletValidationError) {
      throw new GqlInputError(e.message)
    }
    throw new GqlInputError('failed to create invoice: ' + e.message)
  }

  if (!invoice || !invoice.startsWith('lnbc')) {
    throw new GqlInputError('wallet returned invalid invoice')
  }

  return true
}

// Update an existing protocol's config under a new vault key. Used by
// `updateWalletEncryption` during passphrase rotation; the caller has already
// authenticated and started a transaction, so this is a plain helper rather
// than a GraphQL resolver. `enabled` is intentionally left unchanged.
export async function updateExistingProtocolConfigInTransaction ({ tx, walletId, userId, name, send, config }) {
  const protocol = protocols.find(p => p.name === name && p.send === send)
  if (!protocol) throw new GqlInputError(`unknown protocol: ${name}/${send ? 'send' : 'recv'}`)
  await validateSchema(protocolServerSchema(protocol, { ignoreKeyHash: true }), config)
  const relation = protocolRelationName(protocol)
  const existing = await tx.walletProtocol.findFirst({
    where: {
      walletId: Number(walletId),
      name,
      send,
      wallet: {
        userId
      }
    },
    select: {
      id: true
    }
  })

  if (!existing) throw new GqlInputError('wallet changed, please retry rotation')

  return await tx.walletProtocol.update({
    where: {
      id: existing.id
    },
    data: {
      [relation]: {
        update: dataFragment(protocol, config, 'update')
      }
    },
    select: {
      id: true
    }
  })
}

// Upsert a single protocol inside a Prisma transaction. Used by the atomic
// `saveWalletProtocols` mutation.
// The wallet_to_jsonb trigger that materializes Vault rows into
// WalletProtocol.config is a DEFERRABLE INITIALLY DEFERRED constraint trigger,
// so its execution is queued here and fires at transaction commit. That way the
// trigger sees every Vault row Prisma writes for this upsert, even though Prisma
// writes the relation table before the Vault rows it references. Callers that
// need materialized WalletProtocol.config should read it after the transaction
// commits, as saveWalletProtocols does below.
export async function upsertProtocolInTransaction ({ tx, walletId, userId, protocol, enabled, config }) {
  const relation = protocolRelationName(protocol)
  const id = Number(walletId)

  return await tx.wallet.update({
    where: {
      id,
      // this makes sure that users can only update their own wallets
      // (the update will fail in this case and abort the transaction)
      userId
    },
    data: {
      protocols: {
        upsert: {
          where: {
            WalletProtocol_walletId_send_name_key: {
              walletId: id,
              send: protocol.send,
              name: protocol.name
            }
          },
          update: {
            enabled,
            [relation]: {
              update: dataFragment(protocol, config, 'update')
            }
          },
          create: {
            enabled,
            send: protocol.send,
            name: protocol.name,
            [relation]: {
              create: dataFragment(protocol, config, 'create')
            }
          }
        }
      }
    },
    include: {
      protocols: true
    }
  })
}

function dataFragment (protocol, args, type) {
  return Object.fromEntries(
    Object.entries(args).map(
      ([key, value]) => {
        if (isEncryptedField(protocol, key)) {
          return [key, { [type]: { value: value.value, iv: value.iv } }]
        }
        return [key, value]
      }
    )
  )
}

// Decode a WalletProtocolConfigInput @oneOf wrapper into { protocol, config }.
// GraphQL has already enforced that exactly one branch is set; we just look up
// the protocol by relation name and unwrap the WebLN boolean sentinel.
function decodeWalletProtocolConfig (configWrapper) {
  const [relationName, value] = Object.entries(configWrapper)[0]
  const protocol = reverseProtocolRelationName(relationName)
  if (!protocol) throw new GqlInputError(`unknown wallet protocol: ${relationName}`)
  if (typeof value === 'boolean') {
    if (value !== true) throw new GqlInputError(`${relationName} must be true`)
    return { protocol, config: {} }
  }
  return { protocol, config: value }
}

// Atomic configure-save: validate every upsert, then apply upserts + removes
// + last-protocol wallet deletion + badge updates inside a single transaction
// so the wallet can never land in a partially-saved state.
export async function saveWalletProtocols (parent, { walletId, templateName, upserts = [], removeIds = [] }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()
  assertApiKeyNotPermitted({ me })

  if (!walletId === !templateName) {
    throw new GqlInputError('exactly one of walletId and templateName is required')
  }
  if (upserts.length === 0 && removeIds.length === 0) {
    throw new GqlInputError('nothing to save')
  }
  if (templateName && removeIds.length > 0) {
    throw new GqlInputError('cannot remove protocols from a wallet that does not exist yet')
  }

  const { vaultKeyHash } = await models.user.findUnique({ where: { id: me.id } })

  // Pre-validate every upsert so we fail fast before any DB writes. GraphQL
  // @oneOf already guaranteed shape; this catches yup-level rules like
  // hex/length constraints and keyHash mismatches.
  const validatedUpserts = upserts.map(({ enabled, config: wrapper }) => {
    const { protocol, config } = decodeWalletProtocolConfig(wrapper)
    return { protocol, enabled, config }
  })
  for (const { protocol, config } of validatedUpserts) {
    try {
      await validateSchema(protocolServerSchema(protocol, { keyHash: vaultKeyHash }), config)
    } catch (e) {
      throw new GqlInputError(`${protocolRelationName(protocol)}: ${e.message}`)
    }
  }

  const removeIdNumbers = removeIds.map(Number)

  const savedWalletId = await models.$transaction(async (tx) => {
    let resolvedWalletId = walletId ? Number(walletId) : undefined

    if (templateName) {
      const { id } = await tx.wallet.create({ data: { templateName, userId: me.id } })
      resolvedWalletId = id
    } else {
      // Explicit ownership check. The wallet.update inside upsertProtocolInTransaction
      // and the wallet condition on deleteMany would also enforce this, but a
      // clear up-front error beats Prisma's opaque "record not found".
      const owned = await tx.wallet.findUnique({
        where: { id: resolvedWalletId, userId: me.id },
        select: { id: true }
      })
      if (!owned) throw new GqlInputError('wallet not found')
    }

    for (const { protocol, enabled, config } of validatedUpserts) {
      await upsertProtocolInTransaction({ tx, walletId: resolvedWalletId, userId: me.id, protocol, enabled, config })
    }

    if (removeIdNumbers.length > 0) {
      // vaults are deleted via trigger
      const { count } = await tx.walletProtocol.deleteMany({
        where: { id: { in: removeIdNumbers }, walletId: resolvedWalletId, wallet: { userId: me.id } }
      })
      if (count !== removeIdNumbers.length) {
        throw new GqlInputError('one or more wallet protocols to remove were not found')
      }
    }

    const protocolCount = await tx.walletProtocol.count({
      where: { walletId: resolvedWalletId }
    })

    // No protocols left — drop the wallet stub so the user does not see an
    // empty entry on the configure page.
    if (protocolCount === 0) {
      await tx.wallet.delete({ where: { id: resolvedWalletId } })
      await updateWalletBadges({ userId: me.id, tx })
      return null
    }

    await updateWalletBadges({ userId: me.id, tx })

    return resolvedWalletId
  })

  if (!savedWalletId) return null

  // The wallet_to_jsonb trigger fires at transaction commit, so hydrate the
  // response after the write transaction instead of forcing deferred triggers to
  // run early inside the transaction.
  const wallet = await models.wallet.findUnique({
    where: { id: savedWalletId, userId: me.id },
    include: {
      template: true,
      protocols: {
        orderBy: {
          id: 'asc'
        }
      }
    }
  })

  return wallet ? mapWalletResolveTypes(wallet) : null
}

async function walletLogs (parent, { protocolId, walletId, payInId, cursor }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  const decodedCursor = decodeCursor(cursor)
  const where = {
    userId: me.id,
    createdAt: {
      lt: decodedCursor.time
    },
    level: { not: 'DEBUG' }
  }

  if (protocolId !== undefined) {
    where.protocolId = protocolId
  }
  if (walletId !== undefined) {
    const walletIdNumber = Number(walletId)
    if (!Number.isSafeInteger(walletIdNumber) || walletIdNumber <= 0) {
      throw new GqlInputError('invalid wallet id')
    }
    where.protocol = {
      walletId: walletIdNumber,
      wallet: {
        userId: me.id
      }
    }
  }
  if (payInId !== undefined) {
    where.payInId = payInId
  }

  const logs = await models.walletLog.findMany({
    where,
    orderBy: {
      createdAt: 'desc'
    },
    take: LIMIT,
    skip: decodedCursor.offset,
    include: {
      protocol: {
        include: {
          wallet: {
            include: {
              template: true
            }
          }
        }
      }
    }
  })

  return {
    entries: logs.map(log => {
      const protocol = log.protocol && Number(log.protocol.wallet.userId) === Number(me.id)
        ? log.protocol
        : null

      return {
        ...log,
        protocol,
        ...(protocol
          ? {
              wallet: {
                ...protocol.wallet,
                name: protocol.wallet.template.name
              }
            }
          : {})
      }
    }),
    cursor: logs.length === LIMIT ? nextCursorEncoded(decodedCursor, LIMIT) : null
  }
}

async function addWalletLog (parent, { protocolId, level, message, timestamp, payInId, updateStatus }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  if (protocolId != null) {
    const protocol = await models.walletProtocol.findFirst({
      where: {
        id: Number(protocolId),
        wallet: {
          userId: me.id
        }
      },
      select: {
        id: true
      }
    })

    if (!protocol) {
      throw new GqlInputError('wallet protocol not found')
    }
  }
  if (payInId != null) {
    const payIn = await models.payIn.findFirst({
      where: {
        id: Number(payInId),
        userId: me.id
      },
      select: {
        id: true
      }
    })

    if (!payIn) {
      throw new GqlInputError('payIn not found')
    }
  }

  const logger = walletLogger({ models, protocolId, userId: me.id, payInId })
  switch (level) {
    case 'OK':
      await logger.ok(message, { createdAt: timestamp, updateStatus })
      break
    case 'INFO':
      await logger.info(message, { createdAt: timestamp, updateStatus })
      break
    case 'WARNING':
      await logger.warn(message, { createdAt: timestamp, updateStatus })
      break
    case 'ERROR':
      await logger.error(message, { createdAt: timestamp, updateStatus })
      break
    default:
      throw new GqlInputError('invalid log level')
  }

  return true
}

async function deleteWalletLogs (parent, { protocolId }, { me, models }) {
  if (!me) throw new GqlAuthenticationError()

  await models.walletLog.deleteMany({
    where: {
      userId: me.id,
      protocolId
    }
  })

  return true
}

export async function updateWalletBadges ({ userId, tx }) {
  const pushNotifications = []

  const wallets = await tx.wallet.findMany({
    where: {
      userId
    },
    include: {
      protocols: true
    }
  })

  const { hasRecvWallet: oldHasRecvWallet, hasSendWallet: oldHasSendWallet } = await tx.user.findUnique({ where: { id: userId } })

  const newHasRecvWallet = wallets.some(({ protocols }) => protocols.some(({ send, enabled }) => !send && enabled))
  const newHasSendWallet = wallets.some(({ protocols }) => protocols.some(({ send, enabled }) => send && enabled))

  await tx.user.update({
    where: { id: userId },
    data: {
      hasRecvWallet: newHasRecvWallet,
      hasSendWallet: newHasSendWallet
    }
  })

  const startStreak = async (type) => {
    const streak = await tx.streak.create({
      data: { userId, type, startedAt: new Date() }
    })
    return streak.id
  }

  const endStreak = async (type) => {
    const [streak] = await tx.$queryRaw`
        UPDATE "Streak"
        SET "endedAt" = now(), updated_at = now()
        WHERE "userId" = ${userId}
        AND "type" = ${type}::"StreakType"
        AND "endedAt" IS NULL
        RETURNING "id"
      `
    return streak?.id
  }

  if (!oldHasRecvWallet && newHasRecvWallet) {
    const streakId = await startStreak('HORSE')
    if (streakId) pushNotifications.push(() => notifyNewStreak(userId, { type: 'HORSE', id: streakId }))
  }
  if (!oldHasSendWallet && newHasSendWallet) {
    const streakId = await startStreak('GUN')
    if (streakId) pushNotifications.push(() => notifyNewStreak(userId, { type: 'GUN', id: streakId }))
  }

  if (oldHasRecvWallet && !newHasRecvWallet) {
    const streakId = await endStreak('HORSE')
    if (streakId) pushNotifications.push(() => notifyStreakLost(userId, { type: 'HORSE', id: streakId }))
  }
  if (oldHasSendWallet && !newHasSendWallet) {
    const streakId = await endStreak('GUN')
    if (streakId) pushNotifications.push(() => notifyStreakLost(userId, { type: 'GUN', id: streakId }))
  }

  // run all push notifications at the end to make sure we don't
  // accidentally send push notifications even if transaction fails
  Promise.all(pushNotifications.map(notify => notify())).catch(console.error)
}
