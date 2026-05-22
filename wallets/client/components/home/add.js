import { useMemo, useState } from 'react'
import Link from 'next/link'
import classNames from 'classnames'
import { useWalletImage, useWalletSupport } from '@/wallets/client/hooks'
import { WalletSearch } from '@/wallets/client/components/search'
import { templateNameToPathSegment, walletDisplayName } from '@/wallets/lib/util'
import { addWalletTemplateRoute } from '@/wallets/lib/routes'
import sharedStyles from '@/styles/wallet/shared.module.css'
import homeStyles from '@/styles/wallet/home.module.css'
import SendIcon from '@/svgs/arrow-right-up-line.svg'
import RecvIcon from '@/svgs/arrow-left-down-line.svg'
import { StatusIcon } from './entries'
const styles = { ...sharedStyles, ...homeStyles }

export function AddWalletPanel ({ templates }) {
  const [searchFilter, setSearchFilter] = useState(() => (text) => true)
  const filteredTemplates = useMemo(() => {
    return templates.filter(({ name }) => searchFilter(walletDisplayName(name)) || searchFilter(name))
  }, [searchFilter, templates])

  return (
    <div className={styles.addWalletPanel}>
      <h2>add wallet</h2>
      <p className='text-muted'>Choose a wallet to connect.</p>
      <WalletSearch setSearchFilter={setSearchFilter} />
      <div className='d-flex flex-column gap-3'>
        {filteredTemplates.map(template => (
          <Link key={template.name} href={addWalletTemplateRoute(templateNameToPathSegment(template.name))} className={classNames(styles.surfaceRow, styles.surfaceRowHover, styles.templateRow)}>
            <AddWalletTemplateLabel template={template} />
            <TemplateWalletSupport template={template} />
          </Link>
        ))}
        {filteredTemplates.length === 0 && (
          <div className='d-flex flex-column align-items-center justify-content-center text-center text-muted py-5 px-3'>
            no wallets found
          </div>
        )}
      </div>
    </div>
  )
}

function AddWalletTemplateLabel ({ template }) {
  const [imageError, setImageError] = useState(false)
  const { name } = template
  const image = useWalletImage(name)
  if (!image || imageError) return <span className='d-inline fw-bold'>{walletDisplayName(name)}</span>

  return (
    <img className={styles.templateLogo} onError={() => setImageError(true)} {...image} />
  )
}

function TemplateWalletSupport ({ template }) {
  const support = useWalletSupport(template)

  return (
    <span className={styles.templateSupport}>
      {support.receive && <StatusIcon icon={RecvIcon} status='SUPPORTED' label='receive' />}
      {support.send && <StatusIcon icon={SendIcon} status='SUPPORTED' label='send' />}
    </span>
  )
}
