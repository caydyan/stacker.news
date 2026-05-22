import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletDetailPage, WalletLogs, WalletRoutePage } from '@/wallets/client/components'
import { useRouteWallet } from '@/wallets/client/hooks'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletLogsPage () {
  const { wallet, ready } = useRouteWallet()

  return (
    <WalletRoutePage ready={ready} resource={wallet}>
      {wallet => (
        <WalletDetailPage wallet={wallet} title='logs'>
          <WalletLogs wallet={wallet} />
        </WalletDetailPage>
      )}
    </WalletRoutePage>
  )
}
