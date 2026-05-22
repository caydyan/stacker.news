import { appendLightningAddressDomain, isTemplate, protocolFields, stripLightningAddressDomain, walletLud16Domain } from '@/wallets/lib/util'

export function hasMeaningfulConfig (protocol) {
  if (!protocol) return false
  const fields = protocolFields(protocol)
  if (fields.length === 0) return protocol.enabled !== false

  const config = protocol.config || {}
  return Object.values(config).some(isMeaningfulValue)
}

export function isSavedProtocol (protocol) {
  return !!protocol?.id && !!protocol?.__typename && !isTemplate(protocol)
}

export function normalizeProtocolValues (protocol, values) {
  return {
    ...values,
    enabled: isTemplate(protocol) ? true : values.enabled
  }
}

export function valuesKey (values, protocol, wallet) {
  const normalized = applyLnAddrDomain(protocol, values, wallet, stripLightningAddressDomain)
  return JSON.stringify(Object.keys(normalized ?? {}).sort().reduce((acc, key) => {
    acc[key] = normalized[key]
    return acc
  }, {}))
}

export function entryValuesKey (entry, wallet) {
  return valuesKey(formValuesFromProtocol(entry, wallet), entry, wallet)
}

export function protocolFromFormValues (protocol, values, wallet) {
  const { enabled, ...config } = applyLnAddrDomain(protocol, values, wallet, appendLightningAddressDomain)
  return {
    ...protocol,
    enabled,
    config
  }
}

export function formValuesFromProtocol (protocol, wallet) {
  const values = protocolFields(protocol).reduce((acc, field) => {
    let value = protocol.config?.[field.name]
    if (protocol.name === 'LN_ADDR' && field.name === 'address') {
      value = stripLightningAddressDomain(value, walletLud16Domain(wallet?.name))
    }
    return {
      ...acc,
      [field.name]: value || ''
    }
  }, { enabled: protocol.enabled })
  return normalizeProtocolValues(protocol, values)
}

export function emptyDisabledEntry (protocol) {
  return {
    name: protocol.name,
    send: protocol.send,
    __typename: isTemplate(protocol) ? 'WalletProtocolTemplate' : 'WalletProtocol',
    enabled: false,
    config: {}
  }
}

export function applyLnAddrDomain (protocol, values, wallet, transform) {
  values = normalizeProtocolValues(protocol, values)
  if (protocol.name !== 'LN_ADDR' || !Object.prototype.hasOwnProperty.call(values, 'address')) {
    return values
  }
  return {
    ...values,
    address: transform(values.address, walletLud16Domain(wallet?.name))
  }
}

function isMeaningfulValue (value) {
  return value !== '' && value !== false && value !== undefined && value !== null
}
