import Link from 'next/link'
import { getGetServerSideProps } from '@/api/ssrApollo'
import { useMe } from '@/components/me'
import { WalletActionShell, WalletRouteGate } from '@/wallets/client/components'
import { SendForm } from '@/wallets/client/components/send'
import styles from '@/styles/wallet/action.module.css'
import BountyIcon from '@/svgs/bounty-bag.svg'
import { selectedWalletRoute, REWARD_SATS_KEY } from '@/wallets/lib/routes'
import { availableRewardSats, rewardSatsAvailableText } from '@/wallets/client/components/send/reward-sats'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function RewardSatsSendPage () {
  return (
    <WalletRouteGate walletsRequired={false}>
      <RewardSatsSend />
    </WalletRouteGate>
  )
}

function RewardSatsSend () {
  const { me } = useMe()
  const availableSats = availableRewardSats(me)
  const identity = (
    <>
      <BountyIcon className={styles.walletActionInternalIcon} width={18} height={18} />
      <span className={styles.walletActionWalletName}>reward sats</span>
    </>
  )

  if (availableSats <= 0) {
    return (
      <WalletActionShell title='send' identity={identity}>
        <div className={`d-flex flex-column align-items-center justify-content-center gap-4 flex-fill fs-4 ${styles.walletActionSuccess}`}>
          <div>you have no reward sats to withdraw</div>
          <Link href={selectedWalletRoute(REWARD_SATS_KEY)} className='btn btn-secondary'>
            back to wallet
          </Link>
        </div>
      </WalletActionShell>
    )
  }

  return (
    <WalletActionShell
      title='send'
      identity={identity}
      available={{ amount: rewardSatsAvailableText(availableSats) }}
    >
      <SendForm source='reward-sats' availableSats={availableSats} />
    </WalletActionShell>
  )
}
