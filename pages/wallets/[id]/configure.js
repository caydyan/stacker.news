import { getGetServerSideProps } from '@/api/ssrApollo'
import {
  WalletConfigureForm,
  WalletDetailPage,
  WalletRoutePage
} from '@/wallets/client/components'
import { useRouteWallet } from '@/wallets/client/hooks'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletConfigurePage () {
  const { wallet, ready, routeId } = useRouteWallet()

  return (
    <WalletRoutePage ready={ready} resource={wallet}>
      {wallet => (
        <WalletDetailPage wallet={wallet} title='configure'>
          <WalletConfigureForm key={routeId} wallet={wallet} />
        </WalletDetailPage>
      )}
    </WalletRoutePage>
  )
}
