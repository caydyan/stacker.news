import { useMemo } from 'react'
import { protocolClientSchema, protocolFields } from '@/wallets/lib/util'
import { useProtocolEntry } from './context'
import { useLnAddrFormAdapter } from './lightning-address-form'

export function initialProtocolFormValues ({ protocol, fields, entry, siblingEntry, lnAddr }) {
  return fields.reduce((acc, field) => {
    // we only fallback to the existing protocol config because the reducer entry
    // was not initialized yet on first render; after init, the entry is the
    // source of truth everywhere.
    let value = entry === undefined ? protocol.config?.[field.name] : entry.config?.[field.name]

    if (!value && field.share) {
      value = siblingEntry?.config?.[field.name]
    }

    if (entry === undefined && field.name === 'address') {
      value = lnAddr.initialAddress(value)
    }

    return {
      ...acc,
      [field.name]: value || ''
    }
  }, { enabled: entry?.enabled ?? protocol.enabled })
}

export function useProtocolForm (protocol) {
  const entry = useProtocolEntry(protocol)
  const siblingEntry = useProtocolEntry({ name: protocol.name, send: !protocol.send })
  const lnAddr = useLnAddrFormAdapter(protocol)
  const fields = protocolFields(protocol)
  const initial = initialProtocolFormValues({ protocol, fields, entry, siblingEntry, lnAddr })
  const schema = lnAddr.wrapSchema(protocolClientSchema(protocol))

  return useMemo(() => ({ fields, initial, schema }), [fields, initial, schema])
}
