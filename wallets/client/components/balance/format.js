import { numWithUnits } from '@/lib/format'

export function balanceSourceTitle (sourceProtocolName) {
  return sourceProtocolName ? `balance from ${sourceProtocolName}` : undefined
}

export function formatWalletBalanceLoading () {
  try {
    const group = new Intl.NumberFormat(undefined)
      .formatToParts(1000)
      .find(part => part.type === 'group')?.value ?? ','
    return ['L', 'OAD', 'ING'].join(group)
  } catch {
    return 'L,OAD,ING'
  }
}

export function formatWalletBalance ({ amount, currency }) {
  if (currency === 'BTC') {
    return numWithUnits(amount)
  }

  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount / 100)
}
