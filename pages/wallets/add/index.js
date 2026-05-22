import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletHome } from '@/wallets/client/components/home'
import { ADD_WALLET_ROUTE } from '@/wallets/lib/routes'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function AddWalletPage () {
  return <WalletHome routeWalletId={ADD_WALLET_ROUTE} />
}
