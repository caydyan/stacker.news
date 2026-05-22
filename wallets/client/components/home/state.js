import { ADD_WALLET_ROUTE, COWBOY_CREDITS_KEY, REWARD_SATS_KEY, walletKey } from '../../../lib/routes'

export const INTERNAL_WALLET_ENTRIES = [
  {
    kind: 'internal',
    key: REWARD_SATS_KEY,
    name: 'reward sats',
    action: 'send',
    balance: 'rewardSats',
    units: { unitSingular: 'sat', unitPlural: 'sats' }
  },
  {
    kind: 'internal',
    key: COWBOY_CREDITS_KEY,
    name: 'cowboy credits',
    action: 'buy',
    balance: 'cowboyCredits',
    units: { unitSingular: 'cowboy credit', unitPlural: 'cowboy credits' },
    rowUnits: { unitSingular: 'CC', unitPlural: 'CCs' }
  }
]

export function walletHomeEntries (wallets, walletName = wallet => wallet.name) {
  return [
    ...INTERNAL_WALLET_ENTRIES,
    ...wallets.map(wallet => ({
      kind: 'external',
      key: walletKey(wallet),
      name: walletName(wallet),
      wallet
    })),
    { kind: 'add', key: ADD_WALLET_ROUTE, name: 'add wallet' }
  ]
}

export function defaultWalletHomeKey (wallets) {
  return wallets[0] ? walletKey(wallets[0]) : REWARD_SATS_KEY
}

export function selectedWalletHomeEntry (entries, routeWalletId, defaultKey) {
  const routeEntry = routeWalletId ? entries.find(entry => entry.key === routeWalletId) : null
  return routeEntry ?? entries.find(entry => entry.key === defaultKey)
}

export function walletEntrySectionLabel (entry) {
  if (!entry) return null
  if (entry.kind === 'internal') return 'stacker news'
  if (entry.kind === 'external') return 'connected'
  return null
}

export function internalWalletConfig (entryOrKey) {
  const key = typeof entryOrKey === 'string' ? entryOrKey : entryOrKey?.key
  return INTERNAL_WALLET_ENTRIES.find(entry => entry.key === key) ?? null
}
