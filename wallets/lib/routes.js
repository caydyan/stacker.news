export const REWARD_SATS_KEY = 'reward-sats'
export const COWBOY_CREDITS_KEY = 'cowboy-credits'
export const ADD_WALLET_ROUTE = 'add'
export const WALLET_DETAIL_TABS = ['configure', 'logs', 'activity']

// Wallet route map:
// - /wallets: default wallet hub selection
// - /wallets/reward-sats and /wallets/cowboy-credits: internal wallets
// - /wallets/reward-sats/send: internal reward sats withdrawal
// - /wallets/add: add-wallet panel
// - /wallets/add/:template: configure a new wallet from a template
// - /wallets/:id and /wallets/:id/:tab: external wallets by numeric id

export function walletKey (wallet) {
  return String(wallet.id)
}

export function selectedWalletRoute (routeWalletId) {
  return `/wallets/${routeWalletId}`
}

export function addWalletTemplateRoute (template) {
  return `/wallets/${ADD_WALLET_ROUTE}/${template}`
}

export function walletConfigureRoute (routeWalletId) {
  return `${selectedWalletRoute(routeWalletId)}/configure`
}

export function walletReceiveRoute (routeWalletId) {
  return `${selectedWalletRoute(routeWalletId)}/receive`
}

export function walletSendRoute (routeWalletId) {
  return `${selectedWalletRoute(routeWalletId)}/send`
}

export function walletDetailRoute (routeWalletId, tab) {
  return `${selectedWalletRoute(routeWalletId)}/${tab}`
}

export function walletRoute (entry) {
  if (entry.kind === 'external') return selectedWalletRoute(entry.wallet.id)
  return selectedWalletRoute(entry.key)
}
