import copy from 'clipboard-copy'
import { useToast } from '@/components/toast'
import styles from './copy-chip.module.css'

function chipClassName ({ full, tone, truncate, className }) {
  return [
    styles.chip,
    full ? styles.chipFull : null,
    tone === 'danger' ? styles.danger : null,
    truncate ? styles.truncateChip : null,
    className
  ].filter(Boolean).join(' ')
}

export default function CopyChip ({ value, prefix, tailLength = 6, children, full, tone, className, title = value }) {
  const toaster = useToast()
  return (
    <button
      type='button'
      className={chipClassName({ full, tone, truncate: !children, className })}
      title={title}
      onClick={async () => {
        try {
          await copy(value)
          toaster.success('copied')
        } catch (err) {
          console.error('failed to copy chip value:', err)
          toaster.danger('failed to copy')
        }
      }}
    >
      {children ?? <MiddleEllipsis prefix={prefix} value={value} tailLength={tailLength} />}
    </button>
  )
}

export function Chip ({ children, full, tone, className, title, onClick }) {
  if (onClick) {
    return (
      <button type='button' className={chipClassName({ full, tone, className })} title={title} onClick={onClick}>
        {children}
      </button>
    )
  }

  return (
    <span className={chipClassName({ full, tone, className })} title={title}>
      {children}
    </span>
  )
}

export function MiddleEllipsis ({ prefix, value, tailLength = 6 }) {
  const tail = value.slice(-tailLength)
  const head = value.slice(0, -tailLength)
  return (
    <>
      {prefix && <span className={styles.prefix}>{prefix}&nbsp;</span>}
      <span className={styles.middleEllipsis}>
        <span className={styles.head}>{head}</span>
        <span className={styles.tail}>{tail}</span>
      </span>
    </>
  )
}
