import { InputGroup } from 'react-bootstrap'
import classNames from 'classnames'
import { Input, PasswordInput } from '@/components/form'
import Text from '@/components/text'
import Info from '@/components/info'
import { stripLightningAddressDomain, walletLud16Domain } from '@/wallets/lib/util'
import { parseNwcUrl } from '@/wallets/lib/validate'
import { useFormikContext } from 'formik'
import { useWallet } from './hooks/context'

export function WalletProtocolFormField ({ protocol, type, onNwcLud16, ...props }) {
  const wallet = useWallet()
  const formik = useFormikContext()
  const { validate, encrypt, editable, help, share, ...fieldProps } = props
  const [upperHint, bottomHint] = Array.isArray(fieldProps.hint) ? fieldProps.hint : [null, fieldProps.hint]
  const parsedHelp = normalizeHelp(help)
  const readOnly = !!protocol.config?.[fieldProps.name] && editable === false
  const lightningAddressDomain = walletLud16Domain(wallet.name)
  const label = (
    <div className='d-flex align-items-center'>
      {fieldProps.label}
      {parsedHelp && (
        <Info label={parsedHelp.label}>
          <Text>{parsedHelp.text}</Text>
        </Info>
      )}
      <small className={classNames('text-muted', !help && 'ms-2')}>
        {upperHint
          ? <Text>{upperHint}</Text>
          : (!fieldProps.required ? 'optional' : null)}
      </small>
    </div>
  )

  let append, onPaste, onChange
  if (fieldProps.name === 'address' && lightningAddressDomain) {
    append = <InputGroup.Text className='text-monospace'>@{lightningAddressDomain}</InputGroup.Text>
    onPaste = (e) => {
      e.preventDefault()
      const value = (e.clipboardData || window.clipboardData).getData('text')
      formik.setFieldValue(fieldProps.name, stripLightningAddressDomain(value, lightningAddressDomain))
    }
  }

  if (protocol.name === 'NWC' && protocol.send && fieldProps.name === 'url') {
    onChange = (formik, e) => {
      try {
        const { lud16 } = parseNwcUrl(e.target.value)
        if (lud16) onNwcLud16?.(lud16)
      } catch {
        // Ignore partial NWC strings while the user is still typing.
      }
    }
  }

  const inputProps = { ...fieldProps, hint: bottomHint, label, readOnly, append, onPaste, onChange }
  switch (type) {
    case 'text': {
      return <Input {...inputProps} />
    }
    case 'password':
      return <PasswordInput {...inputProps} />
    default:
      return null
  }
}

function normalizeHelp (help) {
  if (!help) return null
  const parseHelpText = text => Array.isArray(text) ? text.join('\n\n') : text
  if (typeof help === 'string') return { label: null, text: help }
  if (Array.isArray(help)) return { label: null, text: parseHelpText(help) }
  return { label: help.label, text: parseHelpText(help.text) }
}
