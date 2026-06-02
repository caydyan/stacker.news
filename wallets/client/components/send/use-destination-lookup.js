import { useCallback, useRef, useState } from 'react'
import { assertSupportedLnAddrPayerData, fetchLnAddrService } from '@/lib/lnurl'
import useDebounceCallback from '@/components/use-debounce-callback'
import { DEFAULT_LNADDR_LOOKUP, DestinationType, parseDestination } from './destination'

// Owns the lightning-address lookup: debounced fetch of the provider service,
// with stale responses discarded by request id. Pure presentation lives in
// destination-input.js; this is the data half.
export function useDestinationLookup () {
  const [loading, setLoading] = useState(false)
  const [service, setService] = useState(DEFAULT_LNADDR_LOOKUP.service)
  const [error, setError] = useState(null)
  const destinationRequestId = useRef(0)

  const checkDestination = useCallback(async (rawValue) => {
    const requestId = ++destinationRequestId.current
    const { value, type } = parseDestination(rawValue)
    setLoading(false)
    setError(null)
    setService(DEFAULT_LNADDR_LOOKUP.service)
    if (!value || type !== DestinationType.LN_ADDR) return

    setLoading(true)
    try {
      const nextService = await fetchLnAddrService(value)
      assertSupportedLnAddrPayerData(nextService)
      if (requestId === destinationRequestId.current) setService({ ...nextService, addr: value })
    } catch (err) {
      console.log('failed to fetch lightning address service:', err)
      if (requestId === destinationRequestId.current) {
        setService(DEFAULT_LNADDR_LOOKUP.service)
        setError(err?.message || 'lightning address check failed')
      }
    } finally {
      if (requestId === destinationRequestId.current) setLoading(false)
    }
  }, [])

  const onDestinationChange = useDebounceCallback(async (formik, e) => {
    await checkDestination(e.target.value)
  }, 500, [checkDestination])

  return {
    lnAddrLookup: { loading, service, error },
    checkDestination,
    onDestinationChange
  }
}
