import { numWithUnits } from '@/lib/format'

export function availableRewardSats (me) {
  return Math.max((me?.privates?.sats ?? 0) - (me?.privates?.credits ?? 0), 0)
}

export function rewardSatsAvailableText (availableSats) {
  return numWithUnits(availableSats, { abbreviate: false, format: true, unitSingular: 'sat', unitPlural: 'sats' })
}

export function availableRewardSatsAfterFee (availableSats, maxFee) {
  return (availableSats ?? 0) - (Number(maxFee) || 0)
}
