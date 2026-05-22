import { Input } from '@/components/form'
import { MiddleEllipsis } from '@/components/copy-chip'
import QrScanner from '@/components/qr-scanner'
import { useToast } from '@/components/toast'
import useDebounceCallback from '@/components/use-debounce-callback'
import { assertSupportedLnAddrPayerData, fetchLnAddrOptions } from '@/lib/lnurl'
import { bolt11Description } from '@/lib/bolt11'
import sharedStyles from '@/styles/wallet/shared.module.css'
import actionStyles from '@/styles/wallet/action.module.css'
import CameraIcon from '@/svgs/camera-line.svg'
import ClipboardIcon from '@/svgs/clipboard-line.svg'
import { useField } from 'formik'
import { useCallback, useEffect, useRef, useState } from 'react'
import classNames from 'classnames'
import { DEFAULT_LNADDR_OPTIONS, parsePaymentTarget, PaymentDestination } from './payment-target-state'
const styles = { ...sharedStyles, ...actionStyles }

// "checking lightning address..." | error | success | reserved blank
function lnAddrStatusText ({ destinationType, loadingLnAddrOptions, lnAddrError }) {
  if (loadingLnAddrOptions) return 'checking lightning address...'
  if (lnAddrError) return lnAddrError
  if (destinationType === PaymentDestination.LN_ADDR) return '\u2713 lightning address'
  return '\u00a0'
}

export function usePaymentTargetOptions () {
  const [destinationType, setDestinationType] = useState(null)
  const [loadingLnAddrOptions, setLoadingLnAddrOptions] = useState(false)
  const [lnAddrOptions, setLnAddrOptions] = useState(DEFAULT_LNADDR_OPTIONS)
  const [lnAddrError, setLnAddrError] = useState(null)
  const destinationRequestId = useRef(0)

  const loadDestinationOptions = useCallback(async (value) => {
    const requestId = ++destinationRequestId.current
    const { target, type } = parsePaymentTarget(value)
    setLoadingLnAddrOptions(false)
    setLnAddrError(null)
    if (!target || !type) {
      setDestinationType(null)
      setLnAddrOptions(DEFAULT_LNADDR_OPTIONS)
      return
    }

    setDestinationType(type)
    setLnAddrOptions(DEFAULT_LNADDR_OPTIONS)

    if (type === PaymentDestination.BOLT11) {
      return
    }

    if (type === PaymentDestination.LN_ADDR) {
      setLoadingLnAddrOptions(true)
      try {
        const options = await fetchLnAddrOptions(target)
        assertSupportedLnAddrPayerData(options)
        if (requestId === destinationRequestId.current) setLnAddrOptions({ ...options, addr: target })
      } catch (err) {
        console.log('failed to fetch lightning address options:', err)
        if (requestId === destinationRequestId.current) {
          setDestinationType(null)
          setLnAddrOptions(DEFAULT_LNADDR_OPTIONS)
          setLnAddrError(err?.message || 'lightning address check failed')
        }
      } finally {
        if (requestId === destinationRequestId.current) setLoadingLnAddrOptions(false)
      }
    }
  }, [])

  const onDestinationChange = useDebounceCallback(async (formik, e) => {
    await loadDestinationOptions(e.target.value)
  }, 500, [loadDestinationOptions])

  return { destinationType, loadingLnAddrOptions, lnAddrOptions, lnAddrError, loadDestinationOptions, onDestinationChange }
}

export function DestinationInput ({ loadingLnAddrOptions, lnAddrError, onDestinationChange, loadDestinationOptions, destinationType }) {
  const [{ value },, helpers] = useField('destination')

  if (destinationType === PaymentDestination.BOLT11) {
    const { target: destination } = parsePaymentTarget(value)
    return (
      <DetectedDestinationRow
        destination={destination}
        type={destinationType}
        checking={loadingLnAddrOptions}
        onReplace={() => {
          helpers.setValue('')
          loadDestinationOptions('')
        }}
      />
    )
  }

  return (
    <Input
      label='invoice or lightning address'
      name='destination'
      as='textarea'
      rows={3}
      required
      autoFocus
      className={styles.walletDestinationInput}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return
        const { target, type } = parsePaymentTarget(e.currentTarget.value)
        if (type !== PaymentDestination.LN_ADDR) return
        e.preventDefault()
        loadDestinationOptions(target)
        e.currentTarget.blur()
      }}
      onChange={onDestinationChange}
      under={
        <>
          <DestinationActions fieldName='destination' onValue={loadDestinationOptions} />
          <div className={classNames(styles.walletLnAddrPending, 'text-muted small line-height-sm')} aria-live='polite'>
            {lnAddrStatusText({ destinationType, loadingLnAddrOptions, lnAddrError })}
          </div>
        </>
      }
    />
  )
}

function DetectedDestinationRow ({ destination, type, checking, onReplace }) {
  const summary = destinationSummary(destination, type, checking)
  return (
    <div className={classNames(styles.surfaceRow, styles.walletDetectedInvoiceRow)}>
      <div className={styles.walletDetectedInvoiceIdentity}>
        <div className={classNames(styles.walletDetectedInvoiceValue, 'font-monospace')} title={destination}>
          <MiddleEllipsis value={summary.title} />
        </div>
        <div className={classNames(styles.walletRowMeta, 'd-flex flex-wrap align-items-center text-muted')}>
          {summary.meta.map((item, index) => (
            <span key={item}>
              {index > 0 && <span className={styles.walletDetectedInvoiceDot}>·</span>}
              {item}
            </span>
          ))}
        </div>
      </div>
      <button type='button' className={styles.textButton} onClick={onReplace}>
        replace
      </button>
    </div>
  )
}

function DestinationActions ({ fieldName, onValue }) {
  const [,, helpers] = useField(fieldName)
  const [scanning, setScanning] = useState(false)
  const [scannerError, setScannerError] = useState(null)
  const toaster = useToast()

  const setDestinationValue = useCallback((rawValue, source) => {
    const { target, type } = parsePaymentTarget(rawValue)
    if (!type) {
      toaster.danger(`${source}: not a bolt11 invoice or lightning address`)
      return false
    }
    helpers.setValue(target)
    onValue?.(target)
    return true
  }, [helpers, onValue, toaster])

  useEffect(() => {
    if (!scanning) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [scanning])

  const pasteDestination = useCallback(async () => {
    try {
      const value = await navigator.clipboard?.readText()
      if (!value) {
        toaster.danger('paste: clipboard is empty')
        return
      }
      setDestinationValue(value, 'paste')
    } catch (err) {
      console.log(err)
      toaster.danger('paste: clipboard unavailable')
    }
  }, [setDestinationValue, toaster])

  return (
    <>
      <div className={classNames(styles.walletInvoiceActions, 'd-inline-flex align-items-center gap-3 w-fit-content mt-2')}>
        <button
          type='button'
          className={styles.textButton}
          onClick={() => {
            setScannerError(null)
            setScanning(true)
          }}
        >
          <CameraIcon height={18} width={18} />
          scan invoice
        </button>
        <button
          type='button'
          className={styles.textButton}
          onClick={pasteDestination}
        >
          <ClipboardIcon height={18} width={18} />
          paste
        </button>
      </div>
      {scanning && (
        <div className={styles.walletInvoiceScannerOverlay}>
          <div className={styles.walletInvoiceScannerHeader}>
            <button
              type='button'
              className={`modal-btn modal-close ${styles.walletInvoiceScannerClose}`}
              onClick={() => setScanning(false)}
              aria-label='close scanner'
            >
              X
            </button>
          </div>
          <div className={styles.walletInvoiceScannerStage}>
            {scannerError
              ? <div className={styles.walletInvoiceScannerError}>{scannerError}</div>
              : (
                <>
                  <div className={styles.walletInvoiceScannerViewport}>
                    <QrScanner
                      components={{ finder: false }}
                      styles={{
                        container: { width: '100%', height: '100%', aspectRatio: '1 / 1' },
                        video: { width: '100%', height: '100%', objectFit: 'cover' }
                      }}
                      onScan={([{ rawValue }]) => {
                        if (setDestinationValue(rawValue, 'qr scan')) setScanning(false)
                      }}
                      onError={(error) => {
                        if (error instanceof DOMException) {
                          console.log(error)
                          setScannerError('camera unavailable. check browser permissions and try again.')
                        } else {
                          const message = error?.message || error?.toString?.() || 'unknown error'
                          toaster.danger(`qr scan: ${message}`)
                          setScannerError(`qr scan: ${message}`)
                        }
                      }}
                    />
                    <div className={styles.walletInvoiceScannerFrame} aria-hidden />
                  </div>
                  <div className={styles.walletInvoiceScannerHint}>Got a QR in your sights?</div>
                </>)}
          </div>
        </div>
      )}
    </>
  )
}

function destinationSummary (destination, type, checking) {
  if (type === PaymentDestination.LN_ADDR) {
    return {
      title: destination,
      meta: [checking ? 'checking lightning address...' : 'lightning address']
    }
  }

  return invoiceDestinationSummary(destination)
}

function invoiceDestinationSummary (invoice) {
  const description = bolt11Description(invoice)
  return {
    title: description || invoice,
    meta: ['bolt11 invoice']
  }
}
