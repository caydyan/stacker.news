import { useCallback, useEffect, useState } from 'react'

export function useWalletProtocolPicker (sharedProtocolNames) {
  const [sharedProtocolName, setSharedProtocolName] = useState(sharedProtocolNames[0])
  const [preferredReceiveProtocolName, setPreferredReceiveProtocolName] = useState()

  useEffect(() => {
    if (!sharedProtocolNames.includes(sharedProtocolName)) setSharedProtocolName(sharedProtocolNames[0])
  }, [sharedProtocolNames, sharedProtocolName])

  const onSharedProtocolChange = useCallback(name => {
    if (sharedProtocolNames.includes(name)) setSharedProtocolName(name)
  }, [sharedProtocolNames])

  const onReceiveProtocolChange = useCallback(name => {
    setPreferredReceiveProtocolName(name)
    if (sharedProtocolNames.includes(name)) setSharedProtocolName(name)
  }, [sharedProtocolNames])

  const forceLnAddrReceive = useCallback(() => setPreferredReceiveProtocolName('LN_ADDR'), [])

  return {
    sharedProtocolName,
    receiveProtocolName: preferredReceiveProtocolName ?? sharedProtocolName,
    forceReceiveProtocol: !!preferredReceiveProtocolName,
    onSharedProtocolChange,
    onReceiveProtocolChange,
    forceLnAddrReceive
  }
}
