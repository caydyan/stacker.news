import { getGetServerSideProps } from '@/api/ssrApollo'
import { WalletActionShell, WalletRoutePage } from '@/wallets/client/components'
import { formatWalletBalance, useWalletCardBalance } from '@/wallets/client/components/balance'
import { SendForm } from '@/wallets/client/components/send'
import { useRouteWallet, useWalletCapabilities } from '@/wallets/client/hooks'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function WalletSendPage () {
  const { wallet, ready } = useRouteWallet()

  return (
    <WalletRoutePage ready={ready} resource={wallet}>
      {wallet => <WalletSend wallet={wallet} />}
    </WalletRoutePage>
  )
}

function WalletSend ({ wallet }) {
  const { canSend, sendProtocol } = useWalletCapabilities(wallet)
  const { balance } = useWalletCardBalance(wallet)
  const available = balance ? { amount: formatWalletBalance(balance) } : undefined
  if (!canSend) {
    return (
      <WalletActionShell wallet={wallet} title='send' available={available}>
        <div className='text-muted text-center'>
          This wallet cannot send right now. Check this wallet's configure page and logs.
        </div>
      </WalletActionShell>
    )
  }

  return (
    <WalletActionShell wallet={wallet} title='send' available={available}>
      <SendForm source='external' wallet={wallet} protocol={sendProtocol} />
    </WalletActionShell>
  )
}
