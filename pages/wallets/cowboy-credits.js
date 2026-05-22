import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletHome } from '@/wallets/client/components/home'
import { COWBOY_CREDITS_KEY } from '@/wallets/lib/routes'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function CowboyCreditsWalletPage () {
  return <WalletHome routeWalletId={COWBOY_CREDITS_KEY} />
}
