import { msatsSatsFloor } from '@/lib/format'
import { fetchLnAddrInvoiceResponse, fetchLnAddrOptions, lnAddrInvoiceUrl, utf8ByteLength } from '@/lib/lnurl'

export const name = 'LN_ADDR'

export const createInvoice = async (
  { msats, description },
  { address },
  { signal }
) => {
  const options = await fetchLnAddrOptions(address, { signal })
  const { min } = options

  if (!msats) {
    // use min sendable amount by default
    msats = 1_000 * min
  }

  // create invoices with a minimum amount of 1 sat
  msats = Math.max(msats, 1_000)

  // most lnurl providers suck nards so we have to floor to nearest sat
  msats = msatsSatsFloor(msats)

  // LUD-12 measures comments in bytes; only forward the description if it
  // actually fits within the provider's allowance.
  const comment = description && utf8ByteLength(description) > 0 && options.commentAllowed >= utf8ByteLength(description)
    ? description
    : undefined
  const body = await fetchLnAddrInvoiceResponse(lnAddrInvoiceUrl(
    options,
    { msats, comment }
  ), { signal })

  return body.pr
}

export const testCreateInvoice = async ({ address }, { signal }) => {
  return await createInvoice({ msats: undefined }, { address }, { signal })
}
