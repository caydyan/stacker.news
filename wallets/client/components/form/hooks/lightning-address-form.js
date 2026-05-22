import { useCallback, useMemo } from 'react'
import { appendLightningAddressDomain, protocolFormId, stripLightningAddressDomain, walletLud16Domain } from '@/wallets/lib/util'
import { parseNwcUrl } from '@/wallets/lib/validate'
import { useToast } from '@/components/toast'
import { useConfigureDispatch, useProtocolEntry, useWallet } from './context'

// Bridges an `lud16` parsed from an NWC URL into the LN_ADDR receive form.
// Autofill is gated by the wallet's expected domain so a hostile NWC URL can
// never silently configure receive to point at an attacker-controlled address.
export function useNwcLightningAddressBridge ({ receiveProtocols, forceLnAddrReceive }) {
  const wallet = useWallet()
  const dispatch = useConfigureDispatch()
  const toaster = useToast()
  const expectedDomain = walletLud16Domain(wallet?.name)

  return useCallback((address) => {
    const protocol = receiveProtocols.find(p => p.name === 'LN_ADDR')
    if (!protocol || !address) return

    const addressDomain = address.split('@')[1]
    if (!expectedDomain || addressDomain !== expectedDomain) {
      toaster.warning("lightning address domain didn't match", { tag: 'nwc-lud16-foreign' })
      return
    }

    forceLnAddrReceive()
    const formId = protocolFormId(protocol)
    dispatch({
      type: 'NWC_LUD16_BRIDGE',
      formId,
      protocol,
      config: { address }
    })
  }, [dispatch, expectedDomain, forceLnAddrReceive, receiveProtocols, toaster, wallet])
}

// Load-time companion to useNwcLightningAddressBridge: seeds the LN_ADDR
// address field from a saved NWC URL's lud16 parameter when the wallet has a
// known lud16 domain. Hook must run unconditionally; returns null for
// non-LN_ADDR forms.
export function useLnAddrAddressSeed (protocol, lightningAddressDomain) {
  const nwcSendEntry = useProtocolEntry({ name: 'NWC', send: true })
  if (protocol.name !== 'LN_ADDR' || !lightningAddressDomain) return null
  if (!nwcSendEntry?.config?.url) return null
  try {
    const { lud16 } = parseNwcUrl(nwcSendEntry.config.url)
    return lud16?.split('@')[1] === lightningAddressDomain ? lud16 : null
  } catch {
    return null
  }
}

// All React-aware LN_ADDR form behavior: strip the wallet's known domain on
// display (and use the NWC seed when one is available), append it back on
// submit. No-op for non-LN_ADDR protocols or wallets without a known domain.
export function useLnAddrFormAdapter (protocol) {
  const wallet = useWallet()
  const domain = walletLud16Domain(wallet?.name)
  const seed = useLnAddrAddressSeed(protocol, domain)

  return useMemo(() => ({
    initialAddress: (rawValue) => {
      if (!domain || protocol.name !== 'LN_ADDR') return rawValue
      return stripLightningAddressDomain(seed ?? rawValue, domain)
    },
    wrapSchema: (schema) => {
      if (!domain) return schema
      return schema.transform(({ address, ...rest }) => ({
        address: appendLightningAddressDomain(address, domain) || '',
        ...rest
      }))
    }
  }), [domain, seed, protocol.name])
}
