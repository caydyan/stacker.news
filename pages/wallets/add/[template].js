import { getGetServerSideProps } from '@/api/ssrApollo'
import {
  WalletConfigureForm,
  WalletDetailPage,
  WalletRoutePage
} from '@/wallets/client/components'
import { useTemplates } from '@/wallets/client/hooks'
import { templatePathSegmentToName } from '@/wallets/lib/util'
import { useRouter } from 'next/router'
import { useMemo } from 'react'

export const getServerSideProps = getGetServerSideProps({ authRequired: true })

export default function AddWalletTemplatePage () {
  const router = useRouter()
  const routeTemplate = router.query.template
  const templates = useTemplates()
  const wallet = useMemo(() => {
    if (!routeTemplate) return null

    const templateName = templatePathSegmentToName(routeTemplate)
    return templates.find(template => template.name === templateName) ?? null
  }, [routeTemplate, templates])

  return (
    <WalletRoutePage ready={router.isReady} resource={wallet} notFoundMessage='this wallet template could not be found'>
      {wallet => (
        <WalletDetailPage wallet={wallet} title='configure'>
          <WalletConfigureForm key={routeTemplate} wallet={wallet} />
        </WalletDetailPage>
      )}
    </WalletRoutePage>
  )
}
