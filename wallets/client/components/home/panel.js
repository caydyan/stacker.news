import Link from 'next/link'
import classNames from 'classnames'
import sharedStyles from '@/styles/wallet/shared.module.css'
import shellStyles from '@/styles/wallet/shell.module.css'
import homeStyles from '@/styles/wallet/home.module.css'
import { WALLET_DETAIL_TABS, walletDetailRoute } from '@/wallets/lib/routes'
import { AddWalletPanel } from './add'
import { WalletActions } from './actions'
import { ExternalWalletBalance, InternalWalletBalance } from './balance'
import { WalletEntryIcon } from './entries'
const styles = { ...sharedStyles, ...shellStyles, ...homeStyles }

export function SelectedWalletPanel ({ entry, templates, walletBalance }) {
  if (!entry) return null
  if (entry.kind === 'add') return <AddWalletPanel templates={templates} />

  return (
    <div className={classNames(styles.selectedWalletPanel, styles.walletMainFlushChild, 'd-flex flex-column align-items-center')}>
      <div className={classNames(styles.selectedWalletHeader, 'd-flex align-items-start justify-content-between gap-4')}>
        <div className={classNames(styles.selectedWalletIdentity, 'd-inline-flex align-items-center text-body fw-bold')}>
          <WalletEntryIcon entry={entry} />
          {entry.kind !== 'external' && <span>{entry.name}</span>}
        </div>
        {entry.kind === 'external' && (
          <nav className='d-none d-md-flex justify-content-end gap-4'>
            {WALLET_DETAIL_TABS.map(tab => (
              <Link key={tab} href={walletDetailRoute(entry.wallet.id, tab)} className={styles.textButton}>{tab}</Link>
            ))}
          </nav>
        )}
      </div>
      {entry.kind === 'external' ? <ExternalWalletBalance walletBalance={walletBalance} /> : <InternalWalletBalance entry={entry} />}
      <WalletActions entry={entry} />
    </div>
  )
}

export function WalletDetailsList ({ entry, onSelect }) {
  if (!entry || entry.kind === 'add') return null

  const items = entry.kind === 'external'
    ? WALLET_DETAIL_TABS.map(tab => ({ key: tab, href: walletDetailRoute(entry.wallet.id, tab), label: tab }))
    : [{ key: 'settings', href: '/settings/wallets', label: 'settings' }]

  return (
    <div className={styles.stackSection}>
      {items.map(item => (
        <Link key={item.key} href={item.href} className={classNames(styles.surfaceRow, styles.surfaceRowHover, 'd-flex align-items-center fw-bold')} onClick={onSelect}>
          {item.label}
        </Link>
      ))}
    </div>
  )
}
