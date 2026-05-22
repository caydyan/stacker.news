import { Fragment, useEffect } from 'react'
import classNames from 'classnames'
import Link from 'next/link'
import { Draggable } from '../dnd'
import { DndProvider, useWalletImage, useWalletStatus, useWalletSupport } from '@/wallets/client/hooks'
import { useWalletCardBalance } from '@/wallets/client/components/balance'
import { balanceSourceTitle, formatWalletBalance, formatWalletBalanceLoading } from '@/wallets/client/components/balance/format'
import sharedStyles from '@/styles/wallet/shared.module.css'
import homeStyles from '@/styles/wallet/home.module.css'
import { walletDisplayName } from '@/wallets/lib/util'
import { COWBOY_CREDITS_KEY, walletRoute } from '@/wallets/lib/routes'
import Plug from '@/svgs/plug.svg'
import SendIcon from '@/svgs/arrow-right-up-line.svg'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import CheckIcon from '@/svgs/check-line.svg'
import DragIcon from '@/svgs/draggable.svg'
import BountyIcon from '@/svgs/bounty-bag.svg'
import CowboyIcon from '@/svgs/cowboy.svg'
import { InternalWalletRowBalance } from './balance'
import { walletEntrySectionLabel } from './state'
const styles = { ...sharedStyles, ...homeStyles }

export function WalletEntryList ({ entries, wallets, selectedKey, onSelect, variant, ordering, onReorder, onExternalBalance }) {
  const mobile = variant === 'mobileList'

  const list = (
    <div className={styles.walletList}>
      {entries.map((entry, index) => {
        const sectionLabel = walletEntrySectionLabel(entry)
        const previousSectionLabel = walletEntrySectionLabel(entries[index - 1])
        const showSectionLabel = sectionLabel && sectionLabel !== previousSectionLabel
        const externalIndex = entry.kind === 'external'
          ? wallets.findIndex(wallet => Number(wallet.id) === Number(entry.wallet.id))
          : -1
        const rowClassName = classNames(
          styles.surfaceRow,
          mobile ? styles.mobileWalletRow : styles.walletRow,
          mobile && styles.surfaceRowHover,
          entry.kind === 'external' && styles.externalWalletRow,
          entry.kind === 'add' && styles.addWalletRow,
          ordering && entry.kind === 'external' && styles.orderingWalletRow,
          entry.key === selectedKey && styles.selectedRing
        )
        const selected = entry.key === selectedKey
        const rowContent = (
          <>
            {ordering && entry.kind === 'external' && <DragIcon className={classNames(styles.orderDragIcon, 'text-muted')} />}
            <WalletEntryRow entry={entry} selected={selected} showSelectedIcon={mobile && selected} onExternalBalance={onExternalBalance} />
          </>
        )
        const row = entry.kind === 'add'
          ? (
            <Link
              href={walletRoute(entry)}
              className={rowClassName}
              onClick={(event) => {
                if (ordering) {
                  event.preventDefault()
                  return
                }
                event.preventDefault()
                onSelect(entry.key)
              }}
            >
              {rowContent}
            </Link>
            )
          : (
            <button
              type='button'
              className={rowClassName}
              onClick={() => {
                if (!ordering) onSelect(entry.key)
              }}
            >
              {rowContent}
            </button>
            )

        return (
          <Fragment key={entry.key}>
            {showSectionLabel && <div className={classNames(styles.walletSectionLabel, 'text-muted text-uppercase line-height-1')}>{sectionLabel}</div>}
            {ordering && entry.kind === 'external'
              ? <Draggable index={externalIndex}>{row}</Draggable>
              : row}
          </Fragment>
        )
      })}
    </div>
  )

  if (!ordering) return list

  return (
    <DndProvider items={wallets} onReorder={onReorder}>
      {list}
    </DndProvider>
  )
}

export function WalletEntryRow ({ entry, showSelectedIcon, onExternalBalance }) {
  if (entry.kind === 'add') {
    return <div className='fw-bold text-center line-height-1'>{entry.name}</div>
  }

  if (entry.kind === 'external') {
    return (
      <>
        <div className={styles.walletRowIdentity}>
          <div className={styles.walletRowLogoLine}>
            <WalletEntryIcon entry={entry} />
          </div>
          <ExternalWalletStatus wallet={entry.wallet} />
        </div>
        <ExternalWalletRowBalance wallet={entry.wallet} onBalance={onExternalBalance} />
        {showSelectedIcon && <CheckIcon width={18} height={18} className={styles.mobileWalletSelectedIcon} />}
      </>
    )
  }

  return (
    <>
      <div className={styles.walletRowIdentity}>
        <div className={styles.walletRowLogoLine}>
          <WalletEntryIcon entry={entry} />
          <div className={classNames(styles.walletRowIdentityName, 'text-truncate fw-bold')}>{entry.name}</div>
        </div>
      </div>
      <InternalWalletRowBalance entry={entry} />
      {showSelectedIcon && <CheckIcon width={18} height={18} className={styles.mobileWalletSelectedIcon} />}
    </>
  )
}

function ExternalWalletRowBalance ({ wallet, onBalance }) {
  const state = useWalletCardBalance(wallet)
  const { status, balance, error, sourceProtocolName, showBalanceSlot } = state
  let content = null
  const title = balanceSourceTitle(sourceProtocolName)

  useEffect(() => {
    onBalance?.(wallet.id, { status, balance, error, sourceProtocolName, showBalanceSlot })
  }, [wallet.id, status, balance, error, sourceProtocolName, showBalanceSlot, onBalance])

  if (showBalanceSlot) {
    if (status === 'ready') {
      content = formatWalletBalance(balance)
    } else if (status === 'loading') {
      content = <span className={styles.walletRowBalanceLoading}>{formatWalletBalanceLoading()}</span>
    } else if (status === 'error') {
      content = (
        <span
          className={classNames('fw-bold text-warning', error === 'permanent' && 'text-danger')}
          title={error === 'permanent' ? 'balance access denied' : 'balance temporarily unavailable'}
        >!
        </span>
      )
    } else if (status === 'unavailable') {
      content = '—'
    }
  }

  return (
    <div className={classNames(styles.walletRowBalance, 'text-truncate')} title={title} aria-hidden={!showBalanceSlot}>
      {content}
    </div>
  )
}

export function WalletEntryIcon ({ entry }) {
  if (entry.kind === 'external') return <ExternalWalletIcon name={entry.wallet.name} />
  if (entry.key === COWBOY_CREDITS_KEY) return <CowboyIcon className={styles.internalWalletIcon} width={28} height={28} />
  if (entry.kind === 'add') return <Plug className={styles.internalWalletIcon} width={24} height={24} />
  return <BountyIcon className={styles.internalWalletIcon} width={28} height={28} />
}

function ExternalWalletIcon ({ name }) {
  const image = useWalletImage(name)
  if (image) return <img className={styles.walletRowLogo} {...image} />
  return <div className={styles.walletRowFallback}>{walletDisplayName(name).slice(0, 1)}</div>
}

function ExternalWalletStatus ({ wallet }) {
  const status = useWalletStatus(wallet)
  const support = useWalletSupport(wallet)

  return (
    <span className={classNames(styles.walletRowMeta, styles.walletRowIdentityMeta, 'd-flex flex-wrap align-items-center text-muted')}>
      {support.receive && <StatusIcon icon={RecvIcon} status={status.receive} label='receive' />}
      {support.send && <StatusIcon icon={SendIcon} status={status.send} label='send' />}
    </span>
  )
}

export function StatusIcon ({ icon: Icon, status, label }) {
  return (
    <span className={styles.statusPill} style={STATUS_STYLE[status]} title={`${label}: ${status.toLowerCase()}`} aria-label={`${label}: ${status.toLowerCase()}`}>
      <Icon className={styles.statusIcon} />
      <span className={styles.statusDivider} aria-hidden />
      <span className={styles.statusLabel}>{label}</span>
    </span>
  )
}

const STATUS_STYLE = {
  OK: { '--state-bg': '#28a745', '--state-color': '#fff' },
  ERROR: { '--state-bg': '#dc3545', '--state-color': '#fff' },
  WARNING: { '--state-bg': '#fd7e14', '--state-color': '#fff' },
  DISABLED: { '--state-bg': 'var(--theme-toolbarHover)', '--state-color': 'var(--theme-grey)' },
  SUPPORTED: {
    '--state-bg': 'var(--bs-body-bg)',
    '--state-color': 'var(--theme-grey)',
    '--status-line-color': 'color-mix(in srgb, var(--theme-borderColor) 88%, #000)'
  }
}
