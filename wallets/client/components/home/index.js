import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { Offcanvas } from 'react-bootstrap'
import classNames from 'classnames'
import { useSetWalletPriorities, useTemplates, useWallets, useWalletSendReady } from '@/wallets/client/hooks'
import { WalletShell, WalletRouteGate } from '@/wallets/client/components'
import sharedStyles from '@/styles/wallet/shared.module.css'
import shellStyles from '@/styles/wallet/shell.module.css'
import homeStyles from '@/styles/wallet/home.module.css'
import CaretDown from '@/svgs/arrow-down-s-fill.svg'
import { walletDisplayName } from '@/wallets/lib/util'
import { COWBOY_CREDITS_KEY, REWARD_SATS_KEY, walletRoute } from '@/wallets/lib/routes'
import { WalletEntryList, WalletEntryRow } from './entries'
import { SelectedWalletPanel, WalletDetailsList } from './panel'
import { defaultWalletHomeKey, selectedWalletHomeEntry, walletHomeEntries } from './state'
const styles = { ...sharedStyles, ...shellStyles, ...homeStyles }

export function WalletHome ({ routeWalletId }) {
  const wallets = useWallets()
  const templates = useTemplates()
  const walletSendReady = useWalletSendReady()
  const setWalletPriorities = useSetWalletPriorities()
  const router = useRouter()
  const [showSwitcher, setShowSwitcher] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [ordering, setOrdering] = useState(false)
  const [walletBalances, setWalletBalances] = useState({})
  const internalWalletSelected = [REWARD_SATS_KEY, COWBOY_CREDITS_KEY].includes(routeWalletId)
  const emptyWalletHomeSelected = !routeWalletId && walletSendReady && wallets.length === 0
  const walletsRequired = !internalWalletSelected && !emptyWalletHomeSelected

  const entries = useMemo(() => walletHomeEntries(wallets, wallet => walletDisplayName(wallet.name)), [wallets])
  const defaultKey = defaultWalletHomeKey(wallets)
  const selectedEntry = selectedWalletHomeEntry(entries, routeWalletId, defaultKey)

  useEffect(() => {
    if (!router.isReady || !walletSendReady || routeWalletId || !selectedEntry) return
    router.replace(walletRoute(selectedEntry), undefined, { shallow: true })
  }, [routeWalletId, router, selectedEntry, walletSendReady])

  const handleSelect = useCallback((key, { navigate = true } = {}) => {
    setShowSwitcher(false)
    if (!navigate) return

    const entry = entries.find(entry => entry.key === key)
    if (!entry) return
    if (entry.kind === 'add') {
      router.push(walletRoute(entry))
    } else {
      router.replace(walletRoute(entry), undefined, { shallow: true })
    }
  }, [entries, router])

  const handleWalletReorder = useCallback(async (reorderedWallets) => {
    await setWalletPriorities(reorderedWallets)
  }, [setWalletPriorities])

  const handleExternalBalance = useCallback((walletId, state) => {
    setWalletBalances(balances => ({ ...balances, [walletId]: state }))
  }, [])

  const selectedBalance = selectedEntry?.kind === 'external' ? walletBalances[selectedEntry.wallet.id] : null

  return (
    <WalletRouteGate walletsRequired={walletsRequired}>
      <WalletShell
        mobileHeader={selectedEntry && (
          <WalletMobileHeader
            selectedEntry={selectedEntry}
            onShowSwitcher={() => setShowSwitcher(true)}
            onShowDetails={() => setShowDetails(true)}
          />
        )}
      >
        <aside className={classNames(styles.walletSidebar, 'd-flex flex-column gap-3')}>
          <h2 className={styles.sidebarTitle}>wallets</h2>
          <WalletListSurface
            entries={entries}
            wallets={wallets}
            selectedEntry={selectedEntry}
            onSelect={handleSelect}
            ordering={ordering}
            onReorder={handleWalletReorder}
            onExternalBalance={handleExternalBalance}
          />
          <WalletOrderingControls wallets={wallets} ordering={ordering} onToggle={() => setOrdering(ordering => !ordering)} />
        </aside>

        <main className={styles.walletMain}>
          <SelectedWalletPanel
            entry={selectedEntry}
            templates={templates}
            walletBalance={selectedBalance}
          />
        </main>

        <WalletBottomSheet show={showSwitcher} onHide={() => setShowSwitcher(false)} title='switch wallet'>
          <WalletListSurface
            entries={entries}
            wallets={wallets}
            selectedEntry={selectedEntry}
            onSelect={handleSelect}
            variant='mobileList'
            ordering={ordering}
            onReorder={handleWalletReorder}
            onExternalBalance={handleExternalBalance}
          />
          <WalletOrderingControls wallets={wallets} ordering={ordering} onToggle={() => setOrdering(ordering => !ordering)} className='mt-3' hintClassName='mt-2' />
        </WalletBottomSheet>

        <WalletBottomSheet show={showDetails} onHide={() => setShowDetails(false)} title='details'>
          <WalletDetailsList entry={selectedEntry} onSelect={() => setShowDetails(false)} />
        </WalletBottomSheet>
      </WalletShell>
    </WalletRouteGate>
  )
}

function WalletMobileHeader ({ selectedEntry, onShowSwitcher, onShowDetails }) {
  if (selectedEntry.kind === 'add') return <div className='d-flex flex-column gap-2' />

  return (
    <div className='d-flex flex-column gap-2'>
      <button className={classNames(styles.surfaceRow, styles.mobileWalletSelector, selectedEntry.kind === 'external' && styles.externalWalletRow)} onClick={onShowSwitcher}>
        <WalletEntryRow entry={selectedEntry} />
        <CaretDown width={18} height={18} className={styles.mobileWalletCaret} />
      </button>
      <button className={classNames(styles.textButton, 'ms-auto')} onClick={onShowDetails}>details</button>
    </div>
  )
}

function WalletListSurface ({ entries, wallets, selectedEntry, onSelect, variant, ordering, onReorder, onExternalBalance }) {
  return (
    <WalletEntryList
      entries={entries}
      wallets={wallets}
      selectedKey={selectedEntry?.key}
      onSelect={onSelect}
      variant={variant}
      ordering={ordering}
      onReorder={onReorder}
      onExternalBalance={onExternalBalance}
    />
  )
}

function WalletOrderingControls ({ wallets, ordering, onToggle, className, hintClassName }) {
  if (wallets.length <= 1) return null

  return (
    <>
      <button className={classNames(styles.textButton, className)} onClick={onToggle}>
        {ordering ? 'done ordering' : 'edit order'}
      </button>
      {ordering && <p className={classNames(styles.orderHint, hintClassName)}>drag external wallets to change wallet priority</p>}
    </>
  )
}

function WalletBottomSheet ({ show, onHide, title, children }) {
  return (
    <Offcanvas className={styles.walletSheet} show={show} onHide={onHide} placement='bottom'>
      <Offcanvas.Header closeButton>
        <Offcanvas.Title>{title}</Offcanvas.Title>
      </Offcanvas.Header>
      <Offcanvas.Body>
        {children}
      </Offcanvas.Body>
    </Offcanvas>
  )
}
