import { NWC_PAY_INVOICE_METHOD, getBalance as getNwcBalance, supportedMethods, nwcTryRun } from '@/wallets/lib/protocols/nwc'
import { WalletPermissionsError } from '@/wallets/client/errors'
import { satsBalance } from '@/wallets/lib/balance'

export const name = 'NWC'

export async function sendPayment (bolt11, { url }, { signal }) {
  const result = await nwcTryRun(nwc => nwc.lnPay({ pr: bolt11 }), { url }, { signal })
  return result.preimage
}

export async function testSendPayment ({ url }, { signal }) {
  const supported = await supportedMethods(url, { signal })
  if (!supported.includes(NWC_PAY_INVOICE_METHOD)) {
    throw new WalletPermissionsError('credentials do not allow spending')
  }
}

export async function getBalance ({ url }, { signal } = {}) {
  const balance = await getNwcBalance(url, { signal })
  return satsBalance(balance)
}
