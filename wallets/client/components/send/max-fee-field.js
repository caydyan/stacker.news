import { useState } from 'react'
import { Input } from '@/components/form'
import CloseIcon from '@/svgs/close-line.svg'
import EditIcon from '@/svgs/edit-line.svg'
import sharedStyles from '@/styles/wallet/shared.module.css'
import actionStyles from '@/styles/wallet/action.module.css'
import classNames from 'classnames'
import { useField } from 'formik'
import { InputGroup } from 'react-bootstrap'
const styles = { ...sharedStyles, ...actionStyles }

export function MaxFeeField () {
  const [showMaxFee, setShowMaxFee] = useState(false)
  const [{ value }] = useField('maxFee')
  const ToggleIcon = showMaxFee ? CloseIcon : EditIcon

  return (
    <div className={classNames(styles.stackSection, styles.walletMaxFee)}>
      <div className={styles.walletMaxFeeSummary}>
        <span className={classNames(styles.walletMaxFeeLabel, 'text-muted font-monospace')}>
          max fee
        </span>
        <button
          type='button'
          className={classNames(styles.chip, styles.walletMaxFeeControl, showMaxFee && styles.chipActive, 'font-monospace')}
          onClick={() => setShowMaxFee(show => !show)}
          aria-expanded={showMaxFee}
        >
          <span className={styles.walletMaxFeeAmount}>{value}</span>
          <span className={classNames(styles.walletMaxFeeUnit, 'text-muted')}>sats</span>
          <ToggleIcon className={classNames(styles.walletMaxFeeIcon, 'text-muted')} width={18} height={18} aria-hidden />
        </button>
      </div>
      {showMaxFee && (
        <Input
          label='max fee'
          name='maxFee'
          type='number'
          step={10}
          required
          append={<InputGroup.Text className='text-monospace'>sats</InputGroup.Text>}
        />
      )}
    </div>
  )
}
