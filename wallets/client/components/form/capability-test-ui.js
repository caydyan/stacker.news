import { useCallback } from 'react'
import classNames from 'classnames'
import sharedStyles from '@/styles/wallet/shared.module.css'
import configureStyles from '@/styles/wallet/configure.module.css'
import { CopyButton } from '@/components/form'
import AccordianItem from '@/components/accordian-item'
import { isTemplate, protocolFormId, protocolLogName } from '@/wallets/lib/util'
import { useFormikContext } from 'formik'
import { hasEmptyRequiredField, touchedFields } from './test-status'
import { useConfigureDispatch } from './hooks/context'
import { TestStatus } from './hooks/reducer'
import ClipboardIcon from '@/svgs/clipboard-line.svg'
const styles = { ...sharedStyles, ...configureStyles }

export function CapabilityTestRow ({ protocol, fields, status, action, onTest, onInvalid }) {
  const { values } = useFormikContext()
  if (values.enabled === false) return null

  return (
    <div className={classNames(styles.capabilityTestRow, 'd-flex align-items-center justify-content-between gap-2 mt-1')}>
      <span className='text-truncate'>
        {protocol.send
          ? 'Test that this wallet can send payments.'
          : 'Test that this wallet can create invoices.'}
      </span>
      <CapabilityTestButton protocol={protocol} fields={fields} status={status} action={action} onTest={onTest} onInvalid={onInvalid} />
    </div>
  )
}

export function CapabilityStateRow ({ protocol, onRemove, onCancel }) {
  const formik = useFormikContext()
  const dispatch = useConfigureDispatch()
  const enabled = formik.values.enabled !== false
  const showToggle = !isTemplate(protocol)
  const formId = protocolFormId(protocol)

  const onEnabledChange = useCallback((e) => {
    const enabled = e.target.checked
    // The bridge effect in CapabilityProtocolForm pushes the committed enabled
    // value back into Formik via setValues; no setFieldValue call needed here.
    dispatch({
      type: 'TOGGLE',
      formId,
      enabled,
      values: formik.values,
      protocol
    })
  }, [dispatch, formId, formik, protocol])

  if (!showToggle && !onRemove && !onCancel) return null

  return (
    <div className='d-flex align-items-center justify-content-between gap-3 mt-1'>
      {onRemove && (
        <button
          type='button'
          className={classNames(styles.textButton, styles.dangerTextButton, 'align-self-center lh-1')}
          onClick={onRemove}
        >
          remove {protocol.send ? 'send' : 'receive'}
        </button>
      )}
      {onCancel && (
        <button
          type='button'
          className={classNames(styles.textButton, 'align-self-center lh-1')}
          onClick={onCancel}
        >
          cancel {protocol.send ? 'send' : 'receive'}
        </button>
      )}
      {showToggle && (
        <label className={styles.capabilitySwitch}>
          <input
            type='checkbox'
            role='switch'
            name='enabled'
            checked={enabled}
            onChange={onEnabledChange}
          />
          <span className={styles.capabilitySwitchTrack} aria-hidden='true' />
          <span className={styles.capabilitySwitchLabel}>{enabled ? 'enabled' : 'disabled'}</span>
        </label>
      )}
    </div>
  )
}

export function CapabilityError ({ message, details }) {
  return (
    <div className={styles.capabilityError}>
      <CopyButton
        value={details || message}
        className={classNames(styles.textButton, styles.capabilityErrorCopy)}
        append={<ClipboardIcon width={16} height={16} />}
        title='copy error details'
        aria-label='copy error details'
      />
      <div className='text-danger fw-bold line-height-sm'>{message}</div>
      {details && (
        <AccordianItem
          header='details'
          body={<pre className={styles.capabilityErrorDetails}>{details}</pre>}
        />
      )}
    </div>
  )
}

function CapabilityTestButton ({ protocol, fields, status, action, onTest, onInvalid }) {
  const formik = useFormikContext()
  const testing = status === TestStatus.TESTING
  // Disable while required fields are empty so the user can't run a test that
  // would either misleadingly noop (empty LN_ADDR derives NOT_SET) or silently
  // dispatch an onInvalid that the form chrome doesn't surface until submit.
  const missingRequired = hasEmptyRequiredField(fields, formik.values)

  const handleTest = async () => {
    const errors = await formik.validateForm()
    formik.setTouched(touchedFields(fields), true)
    if (Object.keys(errors).length > 0) {
      onInvalid(errors, formik.values)
      return
    }
    await onTest(formik.values)
  }

  return (
    <button
      type='button'
      className={classNames(styles.textButton, styles.infoTextButton, styles.capabilityTestButton)}
      disabled={testing || formik.isSubmitting || missingRequired}
      title={missingRequired ? 'fill required fields before testing' : undefined}
      onClick={handleTest}
    >
      {testing ? `testing ${protocolLogName(protocol)}...` : action}
    </button>
  )
}
