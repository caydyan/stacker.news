import { createHash } from 'crypto'
import { bech32 } from 'bech32'
import { lnAddrSchema, utf8ByteLength, validateSchema } from './validate'
import { snFetch, FetchTimeoutError } from './fetch'
import { WALLET_CREATE_INVOICE_TIMEOUT_MS } from './constants'
import { satsToMsats } from './format'
import { assertContentTypeJson, assertResponseOk, readJsonBody, ResponseAssertError } from './url'
import { assertBolt11Msats } from './bolt11'

// Re-export so callers that already depend on lib/lnurl don't need to learn
// about lib/validate just to count comment bytes.
export { utf8ByteLength }

// Stricter than `^[^\s@]+@[^\s@]+$`: rejects empty parts, multiple `@`s, and
// requires a domain label with a TLD. This is a quick sync gate before we
// hand the address to the network or the async yup schema validator.
const LIGHTNING_ADDRESS_REGEX = /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/
const LOCAL_DEV_ADDRESS_REGEX = /^[A-Za-z0-9._+-]+@(?:localhost|app)(?::\d+)?$/

// SN as an LNURL provider: user@stacker.news

export function encodeLNUrl (url) {
  const words = bech32.toWords(Buffer.from(url.toString(), 'utf8'))
  return bech32.encode('lnurl', words, 1023)
}

export function lnurlPayMetadata (username) {
  const description = `Proxied payment to ${username}@stacker.news`
  const metadata = JSON.stringify([
    ['text/plain', description],
    ['text/identifier', `${username}@stacker.news`]
  ])
  return {
    metadata,
    description,
    descriptionHash: createHash('sha256').update(metadata).digest('hex')
  }
}

export function lnurlpUrl (username, baseUrl = process.env.NEXT_PUBLIC_URL) {
  return new URL(`/.well-known/lnurlp/${encodeURIComponent(username)}`, baseUrl).toString()
}

export function lnurlpCallbackUrl (username, baseUrl = process.env.NEXT_PUBLIC_URL) {
  return new URL(`/api/lnurlp/${encodeURIComponent(username)}/pay`, baseUrl).toString()
}

export function lnurlpVerifyUrl (username, hash, baseUrl = process.env.NEXT_PUBLIC_URL) {
  return new URL(`/api/lnurlp/${encodeURIComponent(username)}/verify/${encodeURIComponent(hash)}`, baseUrl).toString()
}

// SN as an LNURL client: paying someone else's lightning address

export function isLightningAddress (value) {
  if (typeof value !== 'string') return false
  if (LIGHTNING_ADDRESS_REGEX.test(value)) return true
  if (process.env.NODE_ENV === 'development' && LOCAL_DEV_ADDRESS_REGEX.test(value)) return true
  return false
}

export async function fetchLnAddrOptions (addr, { signal } = {}) {
  await lnAddrSchema().fields.addr.validate(addr)
  const [name, domain] = addr.split('@')
  let protocol = 'https'
  if (process.env.NODE_ENV === 'development') {
    // support HTTP and HTTPS during development
    protocol = process.env.NEXT_PUBLIC_URL.split('://')[0]
  }

  const unexpectedErrorMessage = 'Lightning address validation failed. Make sure you entered the correct address.'
  let body
  const method = 'GET'
  const url = `${protocol}://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`
  try {
    const res = await snFetch(url, { method, signal, timeout: WALLET_CREATE_INVOICE_TIMEOUT_MS })
    assertResponseOk(res, { method })
    assertContentTypeJson(res, { method })
    body = await readJsonBody(res)
  } catch (err) {
    console.log('Error fetching lnurlp:', err)
    if (err instanceof ResponseAssertError || err instanceof FetchTimeoutError || err.name === 'AbortError') {
      throw err
    }
    if (err.name === 'SyntaxError') {
      throw new Error(`GET ${url}: invalid JSON`)
    }
    throw new Error(unexpectedErrorMessage)
  }
  if (body.status === 'ERROR') {
    // if the response doesn't adhere to spec by providing a `reason` entry, returns a default error message
    throw new Error(body.reason ?? unexpectedErrorMessage)
  }

  const { minSendable, maxSendable, ...leftOver } = body
  const limits = lnAddrSatsLimits({ minSendable, maxSendable })
  return { addr, ...limits, ...leftOver }
}

export function lnAddrPayerData (values, options, me) {
  const payer = {}

  if (options.payerData?.identifier && values.identifier) {
    payer.identifier = `${me.name}@stacker.news`
  }
  if (options.payerData?.name && values.name) {
    payer.name = values.name
  }
  if (options.payerData?.email && values.email) {
    payer.email = values.email
  }
  if (options.payerData?.pubkey && values.pubkey) {
    payer.pubkey = values.pubkey
  }

  // pubkey is a LUD-18 payer-data field that the SN UI cannot currently
  // satisfy. Failing here makes a wallet that mandates it surface a clear
  // error rather than silently sending an invalid payerdata payload.
  for (const key of ['identifier', 'name', 'email', 'pubkey']) {
    if (options.payerData?.[key]?.mandatory && !payer[key]) {
      throw new Error(`${key} is required`)
    }
  }

  return payer
}

export function assertSupportedLnAddrPayerData (options) {
  if (options?.payerData?.pubkey?.mandatory) {
    throw new Error('lightning address requires payer pubkey, which SN does not support')
  }
}

export function lnAddrInvoiceUrl (options, { msats, comment, payer }) {
  const callback = new URL(options.callback)
  callback.searchParams.append('amount', msats)

  if (comment) {
    // LUD-12 caps comments in bytes; using char length silently allows
    // multi-byte unicode comments to slip past wallet limits.
    const bytes = utf8ByteLength(comment)
    if (bytes > 0) {
      if (!options.commentAllowed || bytes > options.commentAllowed) {
        throw new Error(`comment must be at most ${options.commentAllowed || 0} bytes`)
      }
      callback.searchParams.append('comment', comment)
    }
  }

  if (Object.keys(payer || {}).length > 0) {
    callback.searchParams.append('payerdata', JSON.stringify(payer))
  }

  return callback
}

export async function fetchLnAddrInvoice (
  { addr, amount, comment, ...payerValues },
  { me, options, signal, validateInvoice = assertBolt11Msats } = {}
) {
  // High-level send helper: resolve a lightning address into a BOLT11 invoice.
  options = options?.callback && options.addr === addr ? options : await fetchLnAddrOptions(addr, { signal })
  assertSupportedLnAddrPayerData(options)
  await validateSchema(lnAddrSchema, { addr, amount, comment, ...payerValues }, options)

  const msats = satsToMsats(Number(amount))
  const payer = lnAddrPayerData(payerValues, options, me)
  const callback = lnAddrInvoiceUrl(options, { msats, comment, payer })
  const body = await fetchLnAddrInvoiceResponse(callback, { signal })

  if (!body.pr) {
    throw new Error('lightning address did not return a bolt11 invoice')
  }

  // Normalize BOLT11 casing once before downstream payment validation and sends.
  const pr = body.pr.toLowerCase()
  // Default to enforcing that the returned invoice matches the requested
  // amount. Callers that genuinely need raw, unvalidated bytes can pass
  // `validateInvoice: null` to opt out.
  if (validateInvoice) await validateInvoice(pr, msats)

  return { ...body, pr }
}

export async function fetchLnAddrInvoiceResponse (url, { signal } = {}) {
  const method = 'GET'
  const res = await snFetch(url.toString(), { method, signal, timeout: WALLET_CREATE_INVOICE_TIMEOUT_MS })
  assertResponseOk(res, { method })
  assertContentTypeJson(res, { method })

  const body = await readJsonBody(res)
  if (body.status === 'ERROR') {
    throw new Error(body.reason ?? 'lightning address failed')
  }

  return body
}

function lnAddrSatsLimits ({ minSendable, maxSendable }) {
  const min = Math.max(1, Math.ceil(Number(minSendable) / 1000))
  const max = maxSendable == null ? undefined : Math.floor(Number(maxSendable) / 1000)

  if (!Number.isSafeInteger(min)) {
    throw new Error('lightning address returned invalid minimum amount')
  }
  if (max !== undefined && (!Number.isSafeInteger(max) || max < min)) {
    throw new Error('lightning address returned invalid amount range')
  }

  return {
    min,
    ...(max !== undefined ? { max } : {})
  }
}
