import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import { Form, SubmitButton } from '@/components/form'
import Bolt11Info from '@/components/payIn/bolt11-info'
import { Alert } from 'react-bootstrap'
import { useWalletLogger } from '@/wallets/client/hooks/logger'
import sharedStyles from '@/styles/wallet/shared.module.css'
import actionStyles from '@/styles/wallet/action.module.css'
import classNames from 'classnames'
import { FormikConsumer, useFormikContext } from 'formik'
import { DestinationInput, usePaymentTargetOptions } from './payment-target'
import { parsePaymentTarget, PaymentDestination } from './payment-target-state'
import { LightningAddressFields } from './lightning-address-fields'
import { MaxFeeField } from './max-fee-field'
import { sendAmountText } from './amount-text'
import { useSendSubmit } from './send-submit'
import { sendFormSchema } from './schema'
import BackArrow from '@/svgs/arrow-left-line.svg'
const styles = { ...sharedStyles, ...actionStyles }

const MAX_FEE = 10

export function SendForm ({ source, wallet, protocol, availableSats }) {
  const [sent, setSent] = useState(null)
  const [sendError, setSendError] = useState(null)
  const rewardSats = source === 'reward-sats'
  const { destinationType, loadingLnAddrOptions, lnAddrOptions, lnAddrError, loadDestinationOptions, onDestinationChange } = usePaymentTargetOptions()
  // reward-sats is a custodial path that hard-caps fees server-side. External
  // wallets advertise their own capability via `protocol.enforcesMaxFee`.
  const enforcesMaxFee = rewardSats || !!protocol?.enforcesMaxFee
  const isFeeApplicable = [PaymentDestination.BOLT11, PaymentDestination.LN_ADDR].includes(destinationType)
  const supportsMaxFee = enforcesMaxFee && isFeeApplicable
  const showMaxFee = supportsMaxFee
  const showUnsupportedFee = !rewardSats && !!protocol && !enforcesMaxFee && isFeeApplicable
  const logger = useWalletLogger(protocol)
  const onSubmit = useSendSubmit({
    rewardSats,
    protocol,
    supportsMaxFee,
    lnAddrOptions,
    logger,
    onSent: setSent
  })

  const handleSubmit = useCallback(async (values) => {
    setSendError(null)
    try {
      await onSubmit(values)
    } catch (err) {
      console.warn('failed to send wallet payment:', err)
      setSendError(sendErrorDisplay(err))
    }
  }, [onSubmit])

  const handleDestinationChange = useCallback((formik, event) => {
    setSendError(null)
    return onDestinationChange(formik, event)
  }, [onDestinationChange])

  const handleLoadDestinationOptions = useCallback((value) => {
    setSendError(null)
    return loadDestinationOptions(value)
  }, [loadDestinationOptions])

  const schema = useMemo(() => sendFormSchema({ rewardSats, supportsMaxFee, destinationType, loadingLnAddrOptions, lnAddrOptions, availableSats }), [rewardSats, supportsMaxFee, destinationType, loadingLnAddrOptions, lnAddrOptions, availableSats])

  if (sent && wallet) {
    return (
      <div className={`d-flex flex-column flex-fill ${styles.walletActionSuccess}`}>
        <div className={classNames(styles.walletSentBlock, 'd-flex flex-column align-items-center mw-100')}>
          <div className={classNames(styles.walletSentSummary, 'd-flex flex-column align-items-center mw-100')}>
            <div className={classNames(styles.walletSentLabel, 'text-muted')}>sent</div>
            <div className={classNames(styles.walletSentAmount, 'd-flex align-items-end')}>
              {new Intl.NumberFormat().format(sent.sats)}
              <span className={classNames(styles.walletSentAmountUnit, 'text-muted')}>sats</span>
            </div>
            <div className={classNames(styles.walletSentTo, 'text-muted text-center')}>
              to <span className={styles.walletSentDest} title={sent.to}>{sent.to}</span>
            </div>
          </div>
          <Link href={`/wallets/${wallet.id}`} className='btn btn-secondary'>
            back to wallet
          </Link>
        </div>
      </div>
    )
  }

  return (
    <Form
      initial={{
        destination: '',
        amount: 1,
        maxFee: MAX_FEE,
        comment: '',
        identifier: false,
        name: '',
        email: ''
      }}
      schema={schema}
      onSubmit={handleSubmit}
    >
      <div className={classNames(styles.walletActionFields, styles.formResponsiveReset, 'd-flex flex-column')}>
        <DestinationInput
          loadingLnAddrOptions={loadingLnAddrOptions}
          lnAddrError={lnAddrError}
          destinationType={destinationType}
          onDestinationChange={handleDestinationChange}
          loadDestinationOptions={handleLoadDestinationOptions}
        />
        {destinationType === PaymentDestination.LN_ADDR
          ? (
            <LightningAddressFields options={lnAddrOptions} maxFee={renderFeeControl({ showMaxFee, showUnsupportedFee })} />
            )
          : (
            <>
              {destinationType === PaymentDestination.BOLT11 && (
                <FormikConsumer>
                  {({ values }) => <Bolt11Info bolt11={parsePaymentTarget(values.destination).target} />}
                </FormikConsumer>
              )}
              {renderFeeControl({ showMaxFee, showUnsupportedFee })}
            </>
            )}
      </div>
      <WalletSendError error={sendError} onDismiss={() => setSendError(null)} />
      <div className={classNames(styles.walletBottomBar, styles.walletActionFooter)}>
        <Link href={source === 'reward-sats' ? '/wallets/reward-sats' : `/wallets/${wallet.id}`} className={classNames(styles.textButton, styles.walletFooterBackButton)} aria-label='back'>
          <BackArrow className='theme' width={24} height={24} />
          back
        </Link>
        <WalletSendSubmitButton destinationType={destinationType} loadingLnAddrOptions={loadingLnAddrOptions} />
      </div>
    </Form>
  )
}

function renderFeeControl ({ showMaxFee, showUnsupportedFee }) {
  if (showMaxFee) return <MaxFeeField />
  if (showUnsupportedFee) {
    return (
      <div className='text-muted small mt-2'>
        This wallet does not support a per-payment max fee.
      </div>
    )
  }
  return null
}

function WalletSendError ({ error, onDismiss }) {
  if (!error) return null

  return (
    <Alert variant='danger' dismissible onClose={onDismiss} className={classNames(styles.walletActionFields, 'mt-3 mb-0')}>
      <div className='fw-bold'>{error.title}</div>
      {error.message && <div>{error.message}</div>}
    </Alert>
  )
}

function sendErrorDisplay (err) {
  return {
    title: 'payment failed',
    message: err?.message || err?.toString?.() || 'try again or check this wallet\'s logs'
  }
}

function WalletSendSubmitButton ({ destinationType, loadingLnAddrOptions }) {
  const { values } = useFormikContext()
  const appendText = sendAmountText(values, destinationType)

  return (
    <SubmitButton variant='primary' className={styles.walletActionSubmit} appendText={appendText} disabled={loadingLnAddrOptions}>
      send
    </SubmitButton>
  )
}
