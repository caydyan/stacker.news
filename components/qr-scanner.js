import { useEffect, useState } from 'react'

export default function QrScanner ({ loading = null, formats = ['qr_code'], ...props }) {
  const [Scanner, setScanner] = useState(null)

  useEffect(() => {
    let mounted = true
    import('@yudiel/react-qr-scanner').then(mod => {
      if (mounted) setScanner(() => mod.Scanner)
    })
    return () => {
      mounted = false
    }
  }, [])

  if (!Scanner) return loading
  return <Scanner formats={formats} {...props} />
}
