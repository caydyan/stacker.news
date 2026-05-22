import { decode as decodeBolt11 } from 'light-bolt11-decoder'

// Client-side BOLT11 parsing is for UX only. Server payment validation remains
// authoritative and continues to use ln-service in the payment path.

export function safeDecodeBolt11 (bolt11) {
  if (!bolt11) return null
  try {
    return decodeBolt11(bolt11)
  } catch {
    return null
  }
}

export function bolt11Section (decoded, name) {
  return decoded?.sections?.find(section => section.name === name)
}

export function looksLikeBolt11 (value) {
  return /^ln(?:bc|tb|bcrt|tbs)/i.test(value)
}

export function isBolt11PaymentRequest (value) {
  return Boolean(safeDecodeBolt11(value))
}

export function bolt11Msats (bolt11) {
  const amount = bolt11Section(safeDecodeBolt11(bolt11), 'amount')?.value
  return amount ? BigInt(amount) : null
}

export function assertBolt11Msats (bolt11, expectedMsats) {
  const decoded = safeDecodeBolt11(bolt11)
  if (!decoded) {
    throw new Error('invalid bolt11 invoice')
  }
  const msats = bolt11Section(decoded, 'amount')?.value
  if (!msats || BigInt(msats) !== BigInt(expectedMsats)) {
    throw new Error('invoice has incorrect amount')
  }
}

export function bolt11PaymentHash (bolt11) {
  return bolt11Section(safeDecodeBolt11(bolt11), 'payment_hash')?.value
}

export function bolt11Description (bolt11) {
  return bolt11Section(safeDecodeBolt11(bolt11), 'description')?.value?.trim()
}

export function bolt11ToPayment (bolt11) {
  return {
    bolt11,
    hash: bolt11PaymentHash(bolt11),
    msatsRequested: bolt11Msats(bolt11)
  }
}

export function bolt11QrTransform (value) {
  return `lightning:${value.toUpperCase()}`
}

export function normalizeBolt11PaymentRequest (value) {
  let current = value?.trim() ?? ''
  if (!current) return current

  // Apply both URL `lightning=` extraction and `lightning:` prefix stripping
  // repeatedly so that nested forms like `bitcoin:...?lightning=lightning:lnbc1...`
  // or doubly-prefixed strings unwrap all the way down to the bare BOLT11.
  // Guarded against pathological inputs by a small iteration cap.
  for (let i = 0; i < 4; i++) {
    const next = peelLightningWrapping(current)
    if (next === current) return current
    current = next.trim()
  }
  return current
}

function peelLightningWrapping (raw) {
  try {
    const url = new URL(raw)
    for (const [key, lightning] of url.searchParams) {
      if (key.toLowerCase() === 'lightning' && lightning) return lightning
    }
  } catch {
    // Not a URL-like payment target; fall through to prefix handling.
  }

  if (raw.toLowerCase().startsWith('lightning:')) {
    return raw.slice('lightning:'.length)
  }
  return raw
}
