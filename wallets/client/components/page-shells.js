import Moon from '@/svgs/moon-fill.svg'
import { useMe } from '@/components/me'
import { useEffect, useState } from 'react'
import { WalletShellMain } from './layout'
import { WalletPassphrasePrompt, WalletPassphraseSetup } from './passphrase'
import {
  KEY_STORAGE_UNAVAILABLE,
  WRONG_KEY,
  useKey,
  useKeyError,
  useKeySyncInProgress,
  useWalletsError,
  useWalletSendReady
} from '../hooks/global'

function CenteredPrompt ({ children }) {
  return (
    <WalletShellMain>
      <div className='py-5 px-3 px-md-0 w-100 d-flex flex-column align-items-center justify-content-center flex-grow-1 mx-auto' style={{ maxWidth: '500px' }}>
        {children}
      </div>
    </WalletShellMain>
  )
}

export function WalletErrorShell ({ title, message }) {
  return (
    <WalletShellMain>
      <div className='py-5 text-center d-flex flex-column align-items-center justify-content-center flex-grow-1'>
        <span className='text-muted fw-bold my-1'>{title}</span>
        <small className='d-block text-muted'>
          {message}
        </small>
      </div>
    </WalletShellMain>
  )
}

export function WalletLoadingShell ({ message = 'loading wallets' }) {
  return (
    <WalletShellMain mobileTopBar={false}>
      <div className='py-5 text-center d-flex flex-column align-items-center justify-content-center flex-grow-1 text-muted'>
        <Moon className='spin fill-grey' height={28} width={28} />
        <small className='d-block mt-3 text-muted'>{message}</small>
      </div>
    </WalletShellMain>
  )
}

export function WalletRoutePage ({
  ready,
  resource,
  notFoundTitle = 'wallet not found',
  notFoundMessage = 'this wallet could not be found',
  children
}) {
  return (
    <WalletRouteGate>
      {!ready
        ? <WalletLoadingShell />
        : !resource
            ? <WalletErrorShell title={notFoundTitle} message={notFoundMessage} />
            : children(resource)}
    </WalletRouteGate>
  )
}

function walletRouteGateState ({
  walletsRequired = true,
  key,
  keyStorageUnavailable,
  wrongKey,
  keySyncInProgress,
  walletSendReady,
  walletsError,
  showPassphrase,
  hasSendWallet,
  justUnlocked
}) {
  const canRecoverReceiveOnlyPassphrase = wrongKey && showPassphrase && !hasSendWallet

  if (!walletsRequired) return { type: 'ready' }
  if (keyStorageUnavailable) return { type: 'storage-unavailable' }
  if (canRecoverReceiveOnlyPassphrase && !walletsError && !walletSendReady) return { type: 'loading' }
  if (canRecoverReceiveOnlyPassphrase && walletSendReady) return { type: 'passphrase-setup' }
  if (wrongKey) return { type: 'passphrase-prompt' }
  if (walletsError) return { type: 'wallets-error', error: walletsError }
  if (!key || keySyncInProgress || !walletSendReady) return { type: 'loading' }
  if (showPassphrase && !justUnlocked) return { type: 'passphrase-setup' }
  return { type: 'ready' }
}

export function WalletRouteGate ({ children, errorTitle, loadingMessage, walletsRequired = true }) {
  const { me } = useMe()
  const [justUnlocked, setJustUnlocked] = useState(false)
  const key = useKey()
  const keyError = useKeyError()
  const keySyncInProgress = useKeySyncInProgress()
  const walletSendReady = useWalletSendReady()
  const walletsError = useWalletsError()

  useEffect(() => {
    setJustUnlocked(false)
  }, [me?.id])

  useEffect(() => {
    if (!me?.privates?.showPassphrase) {
      setJustUnlocked(false)
    }
  }, [me?.privates?.showPassphrase])

  const state = walletRouteGateState({
    walletsRequired,
    key,
    keyStorageUnavailable: keyError === KEY_STORAGE_UNAVAILABLE,
    wrongKey: keyError === WRONG_KEY,
    keySyncInProgress,
    walletSendReady,
    walletsError,
    showPassphrase: me?.privates?.showPassphrase,
    hasSendWallet: me?.privates?.hasSendWallet,
    justUnlocked
  })

  return renderWalletRouteGateState(state, {
    children,
    errorTitle,
    loadingMessage,
    onPassphraseSuccess: () => setJustUnlocked(true)
  })
}

function renderWalletRouteGateState (state, { children, errorTitle, loadingMessage, onPassphraseSuccess }) {
  switch (state.type) {
    case 'ready':
      return children

    case 'storage-unavailable': {
      const insecureContext = typeof window !== 'undefined' && window.isSecureContext === false
      return (
        <WalletErrorShell
          title='wallets unavailable'
          message={insecureContext
            ? 'wallets require a secure (HTTPS) connection on this device'
            : 'this device does not support storage of cryptographic keys via IndexedDB'}
        />
      )
    }

    case 'loading':
      return <WalletLoadingShell message={loadingMessage} />

    case 'passphrase-setup':
      return (
        <CenteredPrompt>
          <WalletPassphraseSetup />
        </CenteredPrompt>
      )

    case 'passphrase-prompt':
      return (
        <CenteredPrompt>
          <WalletPassphrasePrompt showCancel={false} onSuccess={onPassphraseSuccess} />
        </CenteredPrompt>
      )

    case 'wallets-error':
      return (
        <WalletErrorShell
          title={errorTitle ?? 'failed to load wallets'}
          message={state.error.message ?? 'unknown error'}
        />
      )
  }
}
