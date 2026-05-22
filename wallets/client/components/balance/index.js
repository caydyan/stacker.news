import protocols from '@/wallets/client/protocols'
import { isWallet, orderedSendProtocols } from '@/wallets/lib/util'
import { useEffect, useMemo, useState } from 'react'
import { FetchTimeoutError } from '@/lib/fetch'
import { WalletPermissionsError, WalletValidationError } from '@/wallets/client/errors'
import {
  peekWalletBalance,
  readWalletBalance,
  walletBalanceCacheKey
} from './cache'

export {
  WALLET_BALANCE_TIMEOUT_MS,
  WALLET_BALANCE_TTL_MS,
  invalidateWalletBalanceCache
} from './cache'
export {
  balanceSourceTitle,
  formatWalletBalance,
  formatWalletBalanceLoading
} from './format'

const unavailableBalanceState = { status: 'unavailable', balance: null, error: null }

function classifyWalletBalanceError (err) {
  if (err instanceof WalletPermissionsError || err instanceof WalletValidationError) {
    return 'permanent'
  }

  if (err?.name === 'TimeoutError') {
    return 'temporary'
  }

  if ([401, 403, 404].includes(err?.status)) {
    return 'permanent'
  }

  if (err instanceof FetchTimeoutError || err?.name === 'TypeError') {
    return 'temporary'
  }

  if (err?.status >= 500 || [408, 429].includes(err?.status)) {
    return 'temporary'
  }

  return 'temporary'
}

export function useWalletCardBalance (wallet) {
  const sendProtocol = useMemo(() => pickBalanceProtocol(wallet), [wallet])
  const cacheKey = sendProtocol ? walletBalanceCacheKey(wallet, sendProtocol) : null
  const [state, setState] = useState(() => initialWalletBalanceState(cacheKey))
  const sourceProtocolName = sendProtocol?.name ?? null

  useEffect(() => {
    if (!sendProtocol) {
      setState(unavailableBalanceState)
      return
    }

    let cancelled = false
    const cachedResult = peekWalletBalance(cacheKey)

    setState(cachedResult ? stateFromBalanceResult(cachedResult) : { status: 'loading', balance: null, error: null })
    readWalletBalance(cacheKey, sendProtocol)
      .then(result => {
        if (cancelled) return
        setState(stateFromBalanceResult(result))
      })
      .catch(err => {
        if (cancelled || err?.name === 'AbortError') return
        if (err?.name !== 'TimeoutError') console.warn('failed to fetch wallet balance:', err)
        if (!cachedResult) setState({ status: 'error', balance: null, error: classifyWalletBalanceError(err) })
      })

    return () => {
      cancelled = true
    }
  }, [sendProtocol, cacheKey])

  return {
    ...state,
    sourceProtocolName,
    showBalanceSlot: isWallet(wallet)
  }
}

export function pickBalanceProtocol (wallet) {
  if (!isWallet(wallet)) return null

  // This displays one source balance, not a sum across all send protocols.
  for (const configuredProtocol of orderedSendProtocols(wallet)) {
    const walletProtocol = protocols.find(protocol => protocol.name === configuredProtocol.name)
    if (!walletProtocol?.getBalance) continue

    return {
      id: configuredProtocol.id,
      name: configuredProtocol.name,
      config: configuredProtocol.config,
      getBalance: walletProtocol.getBalance
    }
  }

  return null
}

function initialWalletBalanceState (cacheKey) {
  if (!cacheKey) return unavailableBalanceState

  const cachedResult = peekWalletBalance(cacheKey)
  return cachedResult ? stateFromBalanceResult(cachedResult) : { status: 'loading', balance: null, error: null }
}

function stateFromBalanceResult ({ balance }) {
  if (balance !== null && balance !== undefined) {
    return { status: 'ready', balance, error: null }
  }

  return unavailableBalanceState
}
