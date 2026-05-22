import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import classNames from 'classnames'
import sharedStyles from '@/styles/wallet/shared.module.css'
import configureStyles from '@/styles/wallet/configure.module.css'
import { Form } from '@/components/form'
import { appendLightningAddressDomain, protocolDisplayName, protocolFormId } from '@/wallets/lib/util'
import { useTestSendPayment, useTestCreateInvoice } from '@/wallets/client/hooks'
import { useFormikContext } from 'formik'
import { useConfigureDispatch, useConfigureState, useWallet } from './hooks/context'
import { useProtocolForm } from './hooks/protocol-form'
import { CapabilityStatus, firstValidationError, testErrorDetails } from './test-status'
import { CapabilityError, CapabilityStateRow, CapabilityTestRow } from './capability-test-ui'
import { WalletProtocolFormField } from './capability-fields'
import { TestStatus } from './hooks/reducer'
import { applyLnAddrDomain, hasMeaningfulConfig, isSavedProtocol, valuesKey } from './hooks/protocol'
import { selectStatus, selectTestError } from './hooks/save-state'
const styles = { ...sharedStyles, ...configureStyles }

// Run sync after DOM commit on the client so reducer keys catch up
// before the next click event is dispatched, closing the visible TOCTOU window
// between a Formik change and the canSave readout.
const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export function CapabilityCard ({ title, subtitle, icon, tone, protocols, preferredProtocolName, forcePreferredProtocol, onProtocolChange, onNwcLud16, optional = false }) {
  const configureState = useConfigureState()
  const { entries } = configureState
  const dispatch = useConfigureDispatch()
  const [showProtocolChoices, setShowProtocolChoices] = useState(false)
  const { protocol, hasConfiguredValues, selectProtocolName } = useCapabilityProtocolSelection({
    protocols,
    entries,
    preferredProtocolName,
    forcePreferredProtocol
  })
  const formId = protocolFormId(protocol)
  const status = selectStatus(configureState, formId)
  const [open, setOpen] = useState(hasConfiguredValues)

  useEffect(() => {
    if (hasConfiguredValues) setOpen(true)
  }, [hasConfiguredValues])

  if (!protocol) return null

  const onRemove = async () => {
    if (!hasConfiguredValues) return

    dispatch({ type: 'PROTOCOL_REMOVED', formId })
    setOpen(false)
  }

  const onCancel = () => {
    // Cancel only discards unsaved drafts. Persisted siblings stay untouched
    // so the user does not lose configuration just by backing out of the form.
    const formIds = protocols
      .filter(p => !isSavedProtocol(p))
      .map(protocolFormId)
    if (formIds.length > 0) dispatch({ type: 'UNSAVED_FORMS_CLEARED', formIds })
    setShowProtocolChoices(false)
    setOpen(false)
  }

  return (
    <section
      className={classNames(
        styles.capabilityCard,
        tone === 'send' && styles.sendCapabilityCard,
        tone === 'receive' && styles.receiveCapabilityCard,
        tone === 'fallback' && styles.fallbackCapabilityCard,
        optional && styles.optionalCapabilityCard
      )}
    >
      <div className={classNames(styles.capabilityHeader, 'd-flex align-items-start justify-content-between gap-3 flex-nowrap')}>
        <div className={styles.capabilityTitleBlock}>
          <div className={classNames(styles.capabilityTitleRow, 'd-flex align-items-center')}>
            {icon && <span className={classNames(styles.capabilityIcon, 'd-inline-flex align-items-center justify-content-center flex-shrink-0')}>{icon}</span>}
            <h2>{title}</h2>
          </div>
          <div className={classNames(styles.capabilitySubtitle, 'text-truncate text-muted')}>
            {subtitle}
            {protocols.length > 1 && ` via ${protocolDisplayName(protocol)}`}
          </div>
        </div>
        <CapabilityStatus status={status} />
      </div>

      {open
        ? (
          <>
            {protocols.length > 1 && (
              <CapabilityMethodPicker
                protocol={protocol}
                protocols={protocols}
                showChoices={showProtocolChoices}
                setShowChoices={setShowProtocolChoices}
                onSelect={(option) => {
                  const selectedFormId = protocolFormId(option)
                  dispatch({
                    type: 'METHOD_SWITCHED',
                    siblingFormIds: protocols.map(protocolFormId).filter(formId => formId !== selectedFormId)
                  })
                  selectProtocolName(option.name)
                  onProtocolChange?.(option.name)
                  setShowProtocolChoices(false)
                }}
              />
            )}
            <CapabilityProtocolForm
              key={formId}
              protocol={protocol}
              onNwcLud16={onNwcLud16}
              onRemove={hasConfiguredValues ? onRemove : null}
              onCancel={!hasConfiguredValues ? onCancel : null}
            />
          </>
          )
        : (
          <button
            type='button'
            className={classNames(styles.textButton, styles.infoTextButton, 'align-self-start')}
            onClick={() => setOpen(true)}
          >
            + add
          </button>
          )}
    </section>
  )
}

function useCapabilityProtocolSelection ({ protocols, entries, preferredProtocolName, forcePreferredProtocol }) {
  const [selectedProtocolName, selectProtocolName] = useState()

  const protocol = useMemo(() => {
    const preferred = protocols.find(p => p.name === preferredProtocolName)
    if (forcePreferredProtocol && preferred) return preferred
    if (selectedProtocolName) {
      const selected = protocols.find(p => p.name === selectedProtocolName)
      if (selected) return selected
    }
    const configured = protocols.find(p => hasMeaningfulConfig(entries[protocolFormId(p)]))
    return configured ?? preferred ?? protocols[0]
  }, [protocols, entries, preferredProtocolName, forcePreferredProtocol, selectedProtocolName])

  return {
    protocol,
    hasConfiguredValues: hasMeaningfulConfig(entries[protocolFormId(protocol)]),
    selectProtocolName
  }
}

function CapabilityMethodPicker ({ protocol, protocols, showChoices, setShowChoices, onSelect }) {
  return (
    <div className={styles.capabilityMethod}>
      <strong>{protocolDisplayName(protocol)}</strong>
      <button
        type='button'
        className={classNames(styles.textButton, styles.capabilityTextButton)}
        onClick={() => setShowChoices(show => !show)}
      >
        {showChoices ? 'hide options' : 'change connection'}
      </button>
      {showChoices && (
        <div className={classNames(styles.capabilityProtocolSelector, 'd-flex flex-wrap gap-2')}>
          {protocols.map(option => (
            <button
              key={protocolFormId(option)}
              type='button'
              className={classNames(
                styles.chip,
                option.name === protocol.name && styles.chipActive
              )}
              onClick={() => onSelect(option)}
            >
              {protocolDisplayName(option)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CapabilityProtocolForm ({ protocol, onNwcLud16, onRemove, onCancel }) {
  const wallet = useWallet()
  const configureState = useConfigureState()
  const dispatch = useConfigureDispatch()
  const testSendPayment = useTestSendPayment(protocol)
  const testCreateInvoice = useTestCreateInvoice(protocol)
  const { fields, initial, schema } = useProtocolForm(protocol)
  const formId = protocolFormId(protocol)
  const status = selectStatus(configureState, formId)
  const { error, details } = selectTestError(configureState, formId) ?? {}
  const action = status === TestStatus.TESTED ? 'test again' : 'test'

  const testProtocol = useCallback(async (values) => {
    values = applyLnAddrDomain(protocol, values, wallet, appendLightningAddressDomain)

    if (values.enabled !== false) {
      if (protocol.send) {
        const additionalValues = await testSendPayment(values)
        values = { ...values, ...additionalValues }
      } else {
        await testCreateInvoice(values)
      }
    }

    return values
  }, [protocol, wallet, testSendPayment, testCreateInvoice])

  const onTest = useCallback(async (values) => {
    const key = valuesKey(values, protocol, wallet)
    dispatch({ type: 'TEST_STARTED', formId, valuesKey: key })

    try {
      const committedValues = await testProtocol(values)
      const committedKey = valuesKey(committedValues, protocol, wallet)
      dispatch({ type: 'TEST_PASSED', formId, committedValues, committedKey, testKey: key, protocol })
    } catch (err) {
      const { message, details } = testErrorDetails(err, protocol)
      dispatch({ type: 'TEST_FAILED', formId, error: message, details, valuesKey: key })
    }
  }, [dispatch, formId, protocol, testProtocol, wallet])

  const onInvalid = useCallback((errors, values) => {
    const key = valuesKey(values, protocol, wallet)
    const { message, details } = testErrorDetails(
      { message: firstValidationError(errors) || 'fix validation errors before testing' },
      protocol
    )
    dispatch({ type: 'RECORD_VALIDATION_FAILURE', formId, error: message, details, valuesKey: key })
  }, [dispatch, formId, protocol, wallet])

  return (
    <Form
      initial={initial}
      schema={schema}
      onSubmit={onTest}
      className={classNames(styles.capabilityForm, styles.formResponsiveReset, 'd-flex flex-column gap-3')}
    >
      <CapabilityFormikBridge protocol={protocol} initial={initial} />
      {fields.length === 0 && (
        <p className='text-muted mb-0'>
          No configuration needed for {protocolDisplayName(protocol)}.
        </p>
      )}
      {fields.map(field => <WalletProtocolFormField key={field.name} protocol={protocol} onNwcLud16={onNwcLud16} {...field} />)}

      {error && <CapabilityError message={error} details={details} protocol={protocol} />}

      <CapabilityTestRow protocol={protocol} fields={fields} status={status} action={action} onTest={onTest} onInvalid={onInvalid} />
      <CapabilityStateRow
        protocol={protocol}
        onRemove={onRemove}
        onCancel={onCancel}
      />
    </Form>
  )
}

// Two-way Formik sync, one direction per cause:
// - Every keystroke writes Formik values through to the reducer's `entries`
//   map (VALUES_CHANGED), so selectors can derive status without Formik context.
// - On commit events (test pass, toggle, NWC bridge), the reducer bumps
//   `commitGeneration[formId]` and we push the newly-committed values back into
//   Formik via setValues so test-enriched fields land in the form.
// We use a generation counter instead of `enableReinitialize` because the
// latter calls resetForm on every keystroke (wiping touched/errors) once
// Formik values flow through reducer state on every change.
function CapabilityFormikBridge ({ protocol, initial }) {
  const formik = useFormikContext()
  const { values } = formik
  const dispatch = useConfigureDispatch()
  const { commitGeneration } = useConfigureState()
  const formId = protocolFormId(protocol)

  useIsoLayoutEffect(() => {
    dispatch({ type: 'VALUES_CHANGED', formId, protocol, values })
  }, [dispatch, formId, protocol, values])

  const generation = commitGeneration.get(formId) ?? 0
  const syncedGenerationRef = useRef(generation)
  useIsoLayoutEffect(() => {
    if (syncedGenerationRef.current === generation) return
    syncedGenerationRef.current = generation
    formik.setValues(initial)
  }, [generation, initial, formik])

  return null
}
