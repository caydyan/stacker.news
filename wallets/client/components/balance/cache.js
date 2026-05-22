import { sha256 } from '@noble/hashes/sha2.js'
import { timeoutSignal, withTimeout } from '@/lib/time'

const walletBalanceCache = new Map()
export const WALLET_BALANCE_TTL_MS = 30_000
export const WALLET_BALANCE_TIMEOUT_MS = 10_000

// Cache key embeds wallet/protocol identifiers plus a SHA-256 of the config so
// the raw config (which can contain plaintext credentials in memory) never
// shows up in cache key strings or debug snapshots.
export function walletBalanceCacheKey (wallet, protocol) {
  return `${wallet.id}:${protocol.name}:${protocol.id ?? 'new'}:${stableConfigHash(protocol.config)}`
}

export function invalidateWalletBalanceCache (protocol) {
  if (!protocol) return

  const protocolKey = `:${protocol.name}:${protocol.id ?? 'new'}:`
  for (const key of walletBalanceCache.keys()) {
    if (key.includes(protocolKey)) walletBalanceCache.delete(key)
  }
}

function stableConfigString (config = {}) {
  return JSON.stringify(Object.keys(config).sort().reduce((acc, key) => {
    acc[key] = config[key]
    return acc
  }, {}))
}

function stableConfigHash (config = {}) {
  return Buffer.from(sha256(Buffer.from(stableConfigString(config)))).toString('hex')
}

export function peekWalletBalance (cacheKey, now = Date.now()) {
  const entry = walletBalanceCache.get(cacheKey)
  if (!entry?.fetchedAt) return undefined
  return now - entry.fetchedAt <= WALLET_BALANCE_TTL_MS ? entry.result : undefined
}

export function clearWalletBalanceCache () {
  walletBalanceCache.clear()
}

export async function readWalletBalance (cacheKey, protocol, { signal, now = Date.now(), timeout = WALLET_BALANCE_TIMEOUT_MS } = {}) {
  const cached = peekWalletBalance(cacheKey, now)
  if (cached !== undefined) return cached

  const cachedEntry = walletBalanceCache.get(cacheKey)
  if (cachedEntry?.promise) return await cachedEntry.promise

  const entry = {}
  const balanceSignal = signal ?? timeoutSignal(timeout)
  entry.promise = withTimeout(
    protocol.getBalance(protocol.config, { signal: balanceSignal }),
    timeout
  )
    .then(balance => {
      const result = { balance: balance ?? null }
      if (walletBalanceCache.get(cacheKey) === entry) {
        walletBalanceCache.set(cacheKey, { result, fetchedAt: Date.now() })
      }
      return result
    })
    .catch(err => {
      if (walletBalanceCache.get(cacheKey) === entry) walletBalanceCache.delete(cacheKey)
      throw err
    })

  walletBalanceCache.set(cacheKey, entry)
  return await entry.promise
}
