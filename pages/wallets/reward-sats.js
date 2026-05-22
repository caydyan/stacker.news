import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletHome } from '@/wallets/client/components/home'
import { REWARD_SATS_KEY } from '@/wallets/lib/routes'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function RewardSatsWalletPage () {
  return <WalletHome routeWalletId={REWARD_SATS_KEY} />
}
