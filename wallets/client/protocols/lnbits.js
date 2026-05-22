import { snFetch } from '@/lib/fetch'
import { assertContentTypeJson } from '@/lib/url'
import { msatsBalance } from '@/wallets/lib/balance'

export const name = 'LNBITS'
// LNbits payments API has no per-payment routing fee cap field.
export const enforcesMaxFee = false

export async function sendPayment (bolt11, { url, apiKey }, { signal }) {
  const response = await postPayment(bolt11, { url, apiKey }, { signal })

  const checkResponse = await getPayment(response.payment_hash, { url, apiKey }, { signal })
  if (!checkResponse.preimage) {
    throw new Error('No preimage')
  }

  return checkResponse.preimage
}

export async function testSendPayment ({ url, apiKey }, { signal }) {
  await getWallet({ url, apiKey }, { signal })
}

export async function getBalance ({ url, apiKey }, { signal } = {}) {
  const wallet = await getWallet({ url, apiKey }, { signal })
  return msatsBalance(wallet.balance)
}

async function getWallet ({ url, apiKey }, { signal }) {
  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', apiKey)

  const method = 'GET'
  const res = await snFetch(url, { path: '/api/v1/wallet', method, headers, signal })

  assertContentTypeJson(res, { method })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const wallet = await res.json()
  return wallet
}

async function postPayment (bolt11, { url, apiKey }, { signal }) {
  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', apiKey)

  const body = JSON.stringify({ bolt11, out: true })

  const method = 'POST'
  const res = await snFetch(url, { path: '/api/v1/payments', method, headers, body, signal })

  assertContentTypeJson(res, { method })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const payment = await res.json()
  return payment
}

async function getPayment (paymentHash, { url, apiKey }, { signal }) {
  const headers = new Headers()
  headers.append('Accept', 'application/json')
  headers.append('Content-Type', 'application/json')
  headers.append('X-Api-Key', apiKey)

  const method = 'GET'
  const res = await snFetch(url, { path: `/api/v1/payments/${paymentHash}`, method, headers, signal })

  assertContentTypeJson(res, { method })
  if (!res.ok) {
    const errBody = await res.json()
    throw new Error(errBody.detail)
  }

  const payment = await res.json()
  return payment
}
