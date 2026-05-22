import classNames from 'classnames'
import { useMe } from '@/components/me'
import { numWithUnits } from '@/lib/format'
import { balanceSourceTitle, formatWalletBalance, formatWalletBalanceLoading } from '@/wallets/client/components/balance/format'
import { availableRewardSats } from '@/wallets/client/components/send/reward-sats'
import styles from '@/styles/wallet/home.module.css'
import { internalWalletConfig } from './state'

export function InternalWalletRowBalance ({ entry }) {
  const { amount, units } = useInternalWalletBalance(entry)
  const rowUnits = internalWalletConfig(entry)?.rowUnits ?? units

  return (
    <div className={styles.walletRowBalance}>
      {numWithUnits(amount, { abbreviate: true, format: true, ...rowUnits })}
    </div>
  )
}

export function ExternalWalletBalance ({ walletBalance }) {
  return <BigBalance {...externalWalletBalanceDisplay(walletBalance)} />
}

export function externalWalletBalanceDisplay (walletBalance) {
  const { status = 'unavailable', balance, error, sourceProtocolName } = walletBalance ?? {}
  if (status === 'ready') {
    const { amount, unit } = formatWalletBalanceParts(balance)
    return {
      state: 'ready',
      amount,
      unit,
      title: balanceSourceTitle(sourceProtocolName)
    }
  }

  if (status === 'loading') {
    return { state: 'loading', amount: formatWalletBalanceLoading(), unit: 'sats' }
  }

  if (status === 'error') {
    return {
      state: 'error',
      message: error === 'permanent' ? 'balance access denied' : 'balance temporarily unavailable',
      secondary: error === 'permanent' ? "check this wallet's permissions on the configure page" : 'check your connection and try again'
    }
  }

  return { state: 'unavailable', message: 'balance not exposed by this connection' }
}

function formatWalletBalanceParts (balance) {
  if (balance.currency !== 'BTC') {
    return { amount: formatWalletBalance(balance), unit: balance.currency }
  }
  // Render BTC balances in full (not abbreviated) to match internal wallets;
  // .bigBalanceAmount auto-scales font-size via --balance-chars to fit.
  return {
    amount: new Intl.NumberFormat().format(balance.amount),
    unit: balance.amount === 1 ? 'sat' : 'sats'
  }
}

export function InternalWalletBalance ({ entry }) {
  const { amount, units } = useInternalWalletBalance(entry)

  return (
    <BigBalance
      state='ready'
      amount={new Intl.NumberFormat().format(amount)}
      unit={amount === 1 ? units.unitSingular : units.unitPlural}
    />
  )
}

function BigBalance ({ state, amount, unit, message, secondary, title }) {
  if (state === 'ready' || state === 'loading') {
    return (
      <div className={classNames(styles.bigBalance, state === 'loading' && styles.bigBalanceLoading)} title={title} aria-live={state === 'loading' ? 'polite' : undefined}>
        <BigBalanceAmount>{amount}</BigBalanceAmount>
        <span className={styles.bigBalanceUnit}>{unit}</span>
      </div>
    )
  }

  return (
    <div className={styles.bigBalanceUnavailable}>
      <div className={styles.bigBalanceUnavailableDash}>—</div>
      <div className={styles.bigBalanceUnavailableMessage}>{message}</div>
      {secondary && <div className={styles.bigBalanceErrorMessageSecondary}>{secondary}</div>}
    </div>
  )
}

function BigBalanceAmount ({ children }) {
  const length = String(children).length

  return (
    <span className={styles.bigBalanceAmount} style={{ '--balance-chars': length }}>
      {children}
    </span>
  )
}

function useInternalWalletBalance (entry) {
  const { me } = useMe()
  const config = internalWalletConfig(entry)
  const amount = config?.balance === 'rewardSats'
    ? availableRewardSats(me)
    : me?.privates?.credits ?? 0
  const units = config?.units ?? { unitSingular: 'sat', unitPlural: 'sats' }

  return { amount, units }
}
