import { bolt11Msats, isBolt11PaymentRequest, normalizeBolt11PaymentRequest } from '@/lib/bolt11'
import { isLightningAddress } from '@/lib/validate'

// The idle lookup: no address checked yet. `service` carries only the default
// minimum until a real provider service is fetched (see use-destination-lookup).
export const DEFAULT_LNADDR_LOOKUP = {
  loading: false,
  service: { min: 1 },
  error: null
}

export const DestinationType = {
  BOLT11: 'bolt11',
  LN_ADDR: 'lnaddr'
}

export function parseDestination (value) {
  const destination = normalizeBolt11PaymentRequest(value)
  if (!destination) return { value: '', type: null, invoiceMsats: null }

  if (isBolt11PaymentRequest(destination)) {
    const invoice = destination.toLowerCase()
    return { value: invoice, type: DestinationType.BOLT11, invoiceMsats: bolt11Msats(invoice) }
  }

  if (isLightningAddress(destination)) {
    return { value: destination, type: DestinationType.LN_ADDR, invoiceMsats: null }
  }

  return { value: destination, type: null, invoiceMsats: null }
}

// Single source of truth for where a lightning-address lookup stands. Every
// readiness check and the input's status label derive from this, so they can't
// drift apart.
//   idle    — destination isn't a lightning address
//   loading — provider service is being fetched
//   error   — the fetch or provider rejected the address
//   ready   — fetched service matches the typed address; safe to submit
//   stale   — typed address hasn't been (re)checked yet
export function lnAddrStatus (destination, lnAddrLookup = DEFAULT_LNADDR_LOOKUP) {
  if (destination.type !== DestinationType.LN_ADDR) return 'idle'
  if (lnAddrLookup.error) return 'error'
  if (lnAddrLookup.loading) return 'loading'
  const { service = DEFAULT_LNADDR_LOOKUP.service } = lnAddrLookup
  return service.addr?.toLowerCase() === destination.value.toLowerCase() ? 'ready' : 'stale'
}

// lightning-address fields are shown while loading and once ready
export function isLnAddrPendingOrReady (destination, lnAddrLookup) {
  const status = lnAddrStatus(destination, lnAddrLookup)
  return status === 'loading' || status === 'ready'
}

// submittable only once the checked service matches the typed address
export function isLnAddrReady (destination, lnAddrLookup) {
  return lnAddrStatus(destination, lnAddrLookup) === 'ready'
}
