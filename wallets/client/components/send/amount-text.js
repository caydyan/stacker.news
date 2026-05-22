import { msatsToSats, numWithUnits } from '@/lib/format'
import { bolt11Msats } from '@/lib/bolt11'
import { parsePaymentTarget, PaymentDestination } from './payment-target-state'

export function sendAmountText (values, destinationType) {
  if (destinationType === PaymentDestination.LN_ADDR) return satsAmountText(values.amount)
  if (destinationType === PaymentDestination.BOLT11) {
    const msats = bolt11Msats(parsePaymentTarget(values.destination).target)
    return msats == null ? undefined : msatsAmountText(msats)
  }
}

export function satsAmountText (value) {
  const sats = Number(value)
  if (!Number.isFinite(sats) || sats <= 0) return undefined
  return numWithUnits(sats, { abbreviate: false, format: true, unitSingular: 'sat', unitPlural: 'sats' })
}

export function msatsAmountText (msats) {
  return numWithUnits(msatsToSats(msats), { abbreviate: false, format: true, unitSingular: 'sat', unitPlural: 'sats' })
}
