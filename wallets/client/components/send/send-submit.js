import { useCallback } from 'react'
import { useRouter } from 'next/router'
import { useMutation } from '@apollo/client/react'
import { useMe } from '@/components/me'
import { CREATE_WITHDRAWL, SEND_TO_LNADDR } from '@/fragments/withdrawal'
import { assertBolt11Msats, bolt11Description, bolt11Msats, bolt11ToPayment } from '@/lib/bolt11'
import { fetchLnAddrInvoice } from '@/lib/lnurl'
import { WALLET_SHELL_SEND_PAYMENT_TIMEOUT_MS } from '@/lib/constants'
import { sendWalletPayment } from '@/wallets/client/hooks'
import { protocolSendPayment } from '@/wallets/client/protocols'
import { msatsAmountText, satsAmountText } from './amount-text'
import { invalidateWalletBalanceCache } from '@/wallets/client/components/balance'
import { parsePaymentTarget, PaymentDestination } from './payment-target-state'

function sendOptions (values, supportsMaxFee) {
  return supportsMaxFee ? { maxFee: Number(values.maxFee) } : {}
}

export function useSendSubmit ({ rewardSats, protocol, supportsMaxFee, lnAddrOptions, logger, onSent }) {
  const { me } = useMe()
  const meName = me?.name
  const router = useRouter()
  const [createWithdrawl] = useMutation(CREATE_WITHDRAWL)
  const [sendToLnAddr] = useMutation(SEND_TO_LNADDR)

  return useCallback(async ({ destination, ...values }) => {
    const paymentTarget = parsePaymentTarget(destination)
    if (rewardSats) {
      await sendRewardSatsPayment({ createWithdrawl, router, sendToLnAddr }, paymentTarget, values)
      return
    }
    await sendExternalWalletPayment({ lnAddrOptions, logger, meName, onSent, protocol, supportsMaxFee }, paymentTarget, values)
  }, [createWithdrawl, lnAddrOptions, logger, meName, onSent, protocol, rewardSats, router, sendToLnAddr, supportsMaxFee])
}

async function sendRewardSatsPayment ({ createWithdrawl, router, sendToLnAddr }, { target, type }, values) {
  if (type === PaymentDestination.BOLT11) {
    const msats = bolt11Msats(target)
    if (msats == null) throw new Error('invoice must specify an amount')

    const { data } = await createWithdrawl({ variables: { invoice: target, maxFee: Number(values.maxFee) } })
    await router.push(`/transactions/${data.createWithdrawl.id}`)
    return
  }

  if (type === PaymentDestination.LN_ADDR) {
    const { data } = await sendToLnAddr({
      variables: {
        addr: target,
        ...values,
        amount: Number(values.amount),
        maxFee: Number(values.maxFee)
      }
    })
    await router.push(`/transactions/${data.sendToLnAddr.id}`)
    return
  }

  throw new Error('enter a bolt11 invoice or lightning address')
}

async function sendExternalWalletPayment ({ lnAddrOptions, logger, meName, onSent, protocol, supportsMaxFee }, { target, type }, values) {
  if (type === PaymentDestination.BOLT11) {
    const msats = bolt11Msats(target)
    if (msats == null) throw new Error('invoice must specify an amount')

    const amountText = msatsAmountText(msats)
    await sendExternalPayment({ protocol, bolt11: target, values, supportsMaxFee, logger, amountText })
    const description = bolt11Description(target)
    onSent({ sats: Number(msats / 1000n), to: description || `${target.slice(0, 14)}…${target.slice(-8)}` })
    return
  }

  if (type === PaymentDestination.LN_ADDR) {
    const { pr: bolt11 } = await fetchLnAddrInvoice({
      addr: target,
      ...values,
      amount: Number(values.amount)
    }, { me: { name: meName }, options: lnAddrOptions, validateInvoice: assertBolt11Msats })
    const amountText = satsAmountText(values.amount) ?? target
    await sendExternalPayment({ protocol, bolt11, values, supportsMaxFee, logger, amountText })
    onSent({ sats: Number(values.amount), to: target })
    return
  }

  throw new Error('enter a bolt11 invoice or lightning address')
}

async function sendExternalPayment ({ protocol, bolt11, values, supportsMaxFee, logger, amountText }) {
  try {
    await sendWalletPayment(protocol, bolt11ToPayment(bolt11), logger, {
      ...sendOptions(values, supportsMaxFee),
      amountText,
      timeout: WALLET_SHELL_SEND_PAYMENT_TIMEOUT_MS,
      sendPayment: (bolt11, config, opts) => protocolSendPayment(protocol, bolt11, config, opts)
    })
    invalidateWalletBalanceCache(protocol)
  } catch (err) {
    logger.error(`payment failed: ${err?.message ?? err?.toString?.() ?? 'unknown error'}`)
    throw err
  }
}
