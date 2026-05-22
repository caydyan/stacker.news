import { msatsToSats } from '../../lib/format'

export function satsBalance (amount, currency = 'BTC') {
  if (amount == null || amount === '') return null

  amount = Number(amount)
  return Number.isFinite(amount) ? { amount, currency } : null
}

export function msatsBalance (amount, currency = 'BTC') {
  try {
    return satsBalance(msatsToSats(amount), currency)
  } catch {
    return null
  }
}
