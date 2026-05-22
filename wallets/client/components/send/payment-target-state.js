import { isBolt11PaymentRequest, normalizeBolt11PaymentRequest } from '@/lib/bolt11'
import { isLightningAddress } from '@/lib/lnurl'

export const PaymentDestination = {
  BOLT11: 'bolt11',
  LN_ADDR: 'lnaddr'
}

export const DEFAULT_LNADDR_OPTIONS = { min: 1 }

export function parsePaymentTarget (value) {
  const target = normalizeBolt11PaymentRequest(value)
  if (!target) return { target: '', type: null }

  if (isBolt11PaymentRequest(target)) {
    return { target: target.toLowerCase(), type: PaymentDestination.BOLT11 }
  }

  if (isLightningAddress(target)) {
    return { target, type: PaymentDestination.LN_ADDR }
  }

  return { target, type: null }
}

export function isSupportedPaymentTarget (value) {
  return Boolean(parsePaymentTarget(value).type)
}
