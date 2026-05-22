import { satsToMsats } from '@/lib/format'
import { bolt11Msats } from '@/lib/bolt11'
import { utf8ByteLength } from '@/lib/validate'
import { boolean, mixed, number, object, string } from '@/lib/yup'
import { parsePaymentTarget, PaymentDestination } from './payment-target-state'
import { availableRewardSatsAfterFee } from './reward-sats'

export function sendFormSchema ({ rewardSats, supportsMaxFee, destinationType, loadingLnAddrOptions, lnAddrOptions, availableSats }) {
  const amount = destinationType === PaymentDestination.LN_ADDR
    ? lightningAddressAmountSchema({ rewardSats, lnAddrOptions, availableSats })
    : mixed()

  return object({
    destination: string()
      .required('required')
      .test('bolt11-amount', 'invoice must specify an amount', value => {
        const { target, type } = parsePaymentTarget(value)
        if (type !== PaymentDestination.BOLT11) return true
        return bolt11Msats(target) != null
      })
      .test('lnaddr-ready', 'wait for lightning address check', value => {
        const { target, type } = parsePaymentTarget(value)
        if (type !== PaymentDestination.LN_ADDR) return true
        if (destinationType !== PaymentDestination.LN_ADDR || loadingLnAddrOptions) return false
        return lnAddrOptions.addr === target
      })
      .test('bolt11-balance', 'invoice amount exceeds available reward sats', function (value) {
        if (!rewardSats) return true
        const { target, type } = parsePaymentTarget(value)
        if (type !== PaymentDestination.BOLT11) return true
        const msats = bolt11Msats(target)
        return msats == null || msats <= satsToMsats(availableRewardSatsAfterFee(availableSats, this.parent.maxFee))
      }),
    amount,
    maxFee: number()
      .integer('must be an integer')
      .min(0, 'must be at least 0')
      .test('required-for-max-fee', 'required', value => !supportsMaxFee || value != null),
    comment: lnAddrOptions.commentAllowed
      ? string().test(
        'comment-space',
        'comment exceeds remaining space',
        value => value == null || utf8ByteLength(value) <= lnAddrOptions.commentAllowed)
      : string(),
    identifier: lnAddrOptions.payerData?.identifier?.mandatory ? boolean().oneOf([true], 'required') : boolean(),
    name: lnAddrOptions.payerData?.name?.mandatory ? string().required('required') : string(),
    email: (lnAddrOptions.payerData?.email?.mandatory ? string().required('required') : string()).email('bad email address')
  })
}

function lightningAddressAmountSchema ({ rewardSats, lnAddrOptions, availableSats }) {
  return number()
    .integer('must be an integer')
    .positive('must be positive')
    .min(lnAddrOptions.min || 1, `must be at least ${lnAddrOptions.min || 1}`)
    .test('lnaddr-max', `must be at most ${lnAddrOptions.max}`, value => {
      if (!lnAddrOptions.max || value == null) return true
      return value <= lnAddrOptions.max
    })
    .test('reward-sats-balance', 'amount exceeds available reward sats', function (value) {
      if (!rewardSats || value == null) return true
      return value <= availableRewardSatsAfterFee(availableSats, this.parent.maxFee)
    })
}
