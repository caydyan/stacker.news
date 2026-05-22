import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletErrorShell, WalletLoadingShell, WalletRoutePage } from '@/wallets/client/components'
import { WalletHome } from '@/wallets/client/components/home'
import { useRouteWallet } from '@/wallets/client/hooks'
import { useRouter } from 'next/router'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletSelectedPage () {
  const router = useRouter()
  const { wallet, ready, routeId } = useRouteWallet()
  const id = Number(routeId)

  if (!router.isReady) {
    return <WalletLoadingShell />
  }

  if (!Number.isSafeInteger(id)) {
    return (
      <WalletErrorShell
        title='wallet not found'
        message='this wallet route could not be found'
      />
    )
  }

  return (
    <WalletRoutePage ready={ready} resource={wallet}>
      {() => <WalletHome routeWalletId={routeId} />}
    </WalletRoutePage>
  )
}
