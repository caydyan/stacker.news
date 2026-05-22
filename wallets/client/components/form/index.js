import { useCallback, useMemo } from 'react'
import classNames from 'classnames'
import sharedStyles from '@/styles/wallet/shared.module.css'
import configureStyles from '@/styles/wallet/configure.module.css'
import { isTemplate, protocolFormId } from '@/wallets/lib/util'
import { WalletGuide } from '../layout'
import { WalletDeleteObstacle, WalletSaveDeleteObstacle } from './wallet-delete'
import { useWalletSupport, useSingleFlight } from '@/wallets/client/hooks'
import ArrowUpRight from '@/svgs/arrow-right-up-line.svg'
import ArrowDownLeft from '@/svgs/arrow-left-down-line.svg'
import BackArrow from '@/svgs/arrow-left-line.svg'
import TrashIcon from '@/svgs/delete-bin-line.svg'
import { WalletConfigureFormProvider, useConfigureState, useWallet, useWalletProtocols } from './hooks/context'
import { useNwcLightningAddressBridge } from './hooks/lightning-address-form'
import { useWalletProtocolPicker } from './hooks/protocol-picker'
import { useSaveWallet, WalletStaleConfigError } from './hooks/save-wallet'
import { selectWalletConfigureSaveState } from './hooks/save-state'
import { CapabilityCard } from './capability-card'
import { useToast } from '@/components/toast'
import { useShowModal } from '@/components/modal'
import { useRouter } from 'next/router'
const styles = { ...sharedStyles, ...configureStyles }

export function WalletConfigureForm ({ wallet }) {
  // Keying on wallet identity reseeds the reducer on a real wallet switch
  // (template -> persisted, or persisted -> different wallet) while staying
  // stable across Apollo refetches that return the same id/name. This
  // replaces the never-dispatched INIT_FROM_WALLET action.
  return (
    <WalletConfigureFormProvider key={wallet.id ?? wallet.name} wallet={wallet}>
      <WalletConfigureFormBody />
    </WalletConfigureFormProvider>
  )
}

function WalletConfigureFormBody () {
  const wallet = useWallet()
  const support = useWalletSupport(wallet)
  const sendProtocols = useWalletProtocols(true)
  const receiveProtocols = useWalletProtocols(false)
  const primarySendProtocols = useMemo(() => sendProtocols.filter(p => p.name !== 'WEBLN'), [sendProtocols])
  const fallbackSendProtocols = useMemo(() => sendProtocols.filter(p => p.name === 'WEBLN'), [sendProtocols])
  const sharedProtocolNames = useMemo(() => {
    const receiveNames = new Set(receiveProtocols.map(protocol => protocol.name))
    return primarySendProtocols.map(protocol => protocol.name).filter(name => receiveNames.has(name))
  }, [primarySendProtocols, receiveProtocols])
  const {
    sharedProtocolName,
    receiveProtocolName,
    forceReceiveProtocol,
    onSharedProtocolChange,
    onReceiveProtocolChange,
    forceLnAddrReceive
  } = useWalletProtocolPicker(sharedProtocolNames)
  const configureState = useConfigureState()
  const saveWallet = useSaveWallet()
  const toaster = useToast()
  const router = useRouter()
  const showModal = useShowModal()

  const saveState = useMemo(
    () => selectWalletConfigureSaveState(configureState),
    [configureState])
  const canSave = saveState.canSave

  const onSaveWalletSubmit = useCallback(async () => {
    if (!canSave) return false
    try {
      const walletId = await saveWallet()
      toaster.success('wallet saved')
      await router.push(walletId && !saveState.willDeleteWallet ? `/wallets/${walletId}` : '/wallets')
      return true
    } catch (err) {
      console.error(err)
      toaster.danger(err instanceof WalletStaleConfigError ? err.message : 'failed to save wallet')
      return false
    }
  }, [canSave, saveState.willDeleteWallet, saveWallet, toaster, router])

  const [onSave, inFlight] = useSingleFlight(onSaveWalletSubmit)

  const onSaveClick = useCallback(() => {
    if (!canSave) return
    if (saveState.willDeleteWallet) {
      showModal(onClose => (
        <WalletSaveDeleteObstacle onClose={onClose} onConfirm={onSave} />
      ))
      return
    }
    onSave()
  }, [canSave, saveState.willDeleteWallet, onSave, showModal])

  const onNwcLud16 = useNwcLightningAddressBridge({ receiveProtocols, forceLnAddrReceive })

  return (
    <div className={styles.walletConfigurePage}>
      <main className={styles.walletConfigureMain}>
        <div className={styles.formStack}>
          {support.send && primarySendProtocols.length > 0 && (
            <CapabilityCard
              title='send capability'
              subtitle='wallet payments'
              icon={<ArrowUpRight width={16} height={16} />}
              tone='send'
              protocols={primarySendProtocols}
              preferredProtocolName={sharedProtocolName}
              onProtocolChange={onSharedProtocolChange}
              onNwcLud16={onNwcLud16}
            />
          )}

          {support.receive && receiveProtocols.length > 0 && (
            <CapabilityCard
              title='receive capability'
              subtitle='invoice creation'
              icon={<ArrowDownLeft width={16} height={16} />}
              tone='receive'
              protocols={receiveProtocols}
              preferredProtocolName={receiveProtocolName}
              forcePreferredProtocol={forceReceiveProtocol}
              onProtocolChange={onReceiveProtocolChange}
            />
          )}

          {fallbackSendProtocols.map(protocol => (
            <CapabilityCard
              key={protocolFormId(protocol)}
              title='WebLN fallback'
              subtitle='optional browser support'
              protocols={[protocol]}
              tone='fallback'
              optional
            />
          ))}
        </div>
        {!isTemplate(wallet) && <WalletConfigureDangerZone wallet={wallet} />}
      </main>

      <aside className={classNames(styles.walletConfigureAside, 'd-flex flex-column gap-3')}>
        <div className={classNames(styles.walletConfigureAsideCard, 'd-flex flex-column')}>
          <p className='text-muted mb-0'>
            Set up this wallet&apos;s capabilities, then test them before saving.
          </p>
          <WalletGuide name={wallet.name} />
        </div>
        <div className={classNames(styles.walletConfigureAsideCard, 'd-flex flex-column')}>
          <div className='fw-bold'>save status</div>
          <p className='text-muted mb-0'>
            {saveState.saveStatus}
          </p>
        </div>
      </aside>

      <div className={classNames(styles.walletBottomBar, styles.walletConfigureSaveBar)}>
        <button type='button' className={classNames(styles.textButton, styles.walletFooterBackButton)} onClick={() => router.back()} aria-label='back'>
          <BackArrow className='theme' width={24} height={24} />
          back
        </button>
        {!canSave
          ? <div className={styles.walletConfigureSaveBlocker}>{saveState.blocker}</div>
          : (
            <>
              {saveState.willDeleteWallet && <div className={styles.walletConfigureSaveBlocker}>{saveState.saveStatus}</div>}
              <button
                type='button'
                className={classNames('btn btn-primary fw-bold', styles.walletConfigureSaveButton, inFlight && 'pulse')}
                disabled={inFlight}
                onClick={onSaveClick}
              >
                {inFlight ? 'saving wallet...' : saveState.saveButtonLabel}
              </button>
            </>
            )}
      </div>
    </div>
  )
}

function WalletConfigureDangerZone ({ wallet }) {
  const showModal = useShowModal()
  const router = useRouter()

  return (
    <section className={styles.walletConfigureDangerZone}>
      <div>
        <h2 className='m-0 text-danger fs-5'>danger zone</h2>
        <p>Delete this wallet and its saved send/receive configuration.</p>
      </div>
      <button
        type='button'
        className={classNames(styles.textButton, styles.dangerTextButton, styles.deleteWalletButton)}
        onClick={() => showModal(onClose => (
          <WalletDeleteObstacle wallet={wallet} onClose={onClose} onSuccess={() => router.push('/wallets')} />
        ))}
      >
        <TrashIcon width={16} height={16} /> delete wallet
      </button>
    </section>
  )
}
