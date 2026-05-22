import { useCallback } from 'react'
import { isEncryptedField, isWallet, protocolFields, protocolFormId, protocolRelationName } from '@/wallets/lib/util'
import { useApolloClient, useMutation } from '@apollo/client/react'
import { ME } from '@/fragments/users'
import { SAVE_WALLET_PROTOCOLS, WALLETS } from '@/wallets/client/fragments'
import { useEncryption } from '@/wallets/client/hooks/crypto'
import { requestPersistentStorage } from '@/components/use-indexeddb'
import { clearWalletBalanceCache } from '@/wallets/client/components/balance/cache'
import { useConfigureState, useWallet } from './context'
import { selectCanSave, selectWalletConfigureSaveState } from './save-state'

export class WalletStaleConfigError extends Error {
  constructor () {
    super('wallet changed since last test')
    this.name = 'WalletStaleConfigError'
  }
}

export function useSaveWallet () {
  const wallet = useWallet()
  const configureState = useConfigureState()
  const { entries, removedFormIds } = configureState
  const client = useApolloClient()
  const { encrypt } = useEncryption()
  const [mutate] = useMutation(SAVE_WALLET_PROTOCOLS)

  return useCallback(async () => {
    if (!selectWalletConfigureSaveState(configureState).canSave) {
      throw new WalletStaleConfigError()
    }

    // selectCanSave is the single integrity gate: it returns true only for
    // SAVED or TESTED entries, which excludes untested drafts, in-flight tests,
    // failed tests, and entries with no meaningful config.
    const protocolsToSave = Object.values(entries)
      .filter(p => selectCanSave(configureState, protocolFormId(p)))
    const removeIds = isWallet(wallet)
      ? wallet.protocols
        .filter(p => removedFormIds.has(protocolFormId(p)))
        .map(p => p.id)
      : []

    // Encrypt protected fields client-side once, then hand the whole batch to
    // the server inside a single transaction. Each config is wrapped in a
    // @oneOf branch keyed by the protocol's relation name so the server knows
    // which protocol it is without us having to send name/send separately.
    const upserts = await Promise.all(protocolsToSave.map(async p => ({
      enabled: p.enabled ?? false,
      config: await buildProtocolConfigBranch(encrypt, p)
    })))

    const variables = {
      upserts,
      removeIds
    }
    if (isWallet(wallet)) {
      variables.walletId = wallet.id
    } else {
      variables.templateName = wallet.name
    }

    const { data } = await mutate({ variables })
    const savedWallet = data?.saveWalletProtocols

    requestPersistentStorage()
    // Saved configs may have changed credentials or removed protocols entirely;
    // either way previously cached balances are now suspect.
    clearWalletBalanceCache()

    await client.refetchQueries({ include: [ME, WALLETS] })

    return savedWallet?.id
  }, [wallet, configureState, entries, removedFormIds, encrypt, mutate, client])
}

async function buildProtocolConfigBranch (encrypt, protocol) {
  const branch = protocolRelationName(protocol)
  const config = protocolConfigInput(protocol)
  // WebLN has no config fields; the schema accepts a boolean sentinel.
  if (Object.keys(config).length === 0) {
    return { [branch]: true }
  }
  const entries = await Promise.all(
    Object.entries(config).map(async ([key, value]) => {
      if (!isEncryptedField(protocol, key)) return [key, value]
      return [key, await encrypt(value)]
    })
  )
  return { [branch]: Object.fromEntries(entries) }
}

function protocolConfigInput (protocol) {
  const fieldNames = new Set(protocolFields(protocol).map(field => field.name))
  return Object.fromEntries(
    Object.entries(protocol.config ?? {}).filter(([key]) => fieldNames.has(key))
  )
}
