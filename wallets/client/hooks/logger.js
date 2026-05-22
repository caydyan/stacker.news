import { useLazyQuery, useMutation } from '@apollo/client/react'
import { isAbortError } from '@/lib/error'
import { ADD_WALLET_LOG, WALLET_LOGS, DELETE_WALLET_LOGS } from '@/wallets/client/fragments'
import { useCallback, useMemo, useState, useEffect } from 'react'
import { useShowModal } from '@/components/modal'
import { ObstacleButtons } from '@/components/obstacle'
import { useToast } from '@/components/toast'
import { FAST_POLL_INTERVAL_MS } from '@/lib/constants'
import { isTemplate } from '@/wallets/lib/util'

const EMPTY_LOGS = []

export function useWriteWalletLog () {
  const [addWalletLog] = useMutation(ADD_WALLET_LOG)

  return useCallback(({ protocol, level, message, payInId, updateStatus = false }) => {
    if (protocol && isTemplate(protocol)) return

    return addWalletLog({
      variables: {
        protocolId: protocol ? Number(protocol.id) : null,
        level,
        message,
        timestamp: new Date(),
        payInId,
        updateStatus
      }
    }).catch(err => {
      console.error('error adding wallet log:', err)
    })
  }, [addWalletLog])
}

export function useWalletLoggerFactory () {
  const writeWalletLog = useWriteWalletLog()

  const log = useCallback(({ protocol, level, message, payInId, updateStatus = false }) => {
    console[mapLevelToConsole(level)](`[${protocol ? protocol.name : 'system'}] ${message}`)

    return writeWalletLog({ protocol, level, message, payInId, updateStatus })
  }, [writeWalletLog])

  return useCallback((protocol, payIn) => {
    const payInId = payIn ? Number(payIn.id) : null
    return {
      ok: (message, context = {}) => {
        log({ protocol, level: 'OK', message, payInId, updateStatus: context.updateStatus })
      },
      info: (message, context = {}) => {
        log({ protocol, level: 'INFO', message, payInId, updateStatus: context.updateStatus })
      },
      error: (message, context = {}) => {
        log({ protocol, level: 'ERROR', message, payInId, updateStatus: context.updateStatus })
      },
      warn: (message, context = {}) => {
        log({ protocol, level: 'WARNING', message, payInId, updateStatus: context.updateStatus })
      }
    }
  }, [log])
}

export function useWalletLogger (protocol) {
  const loggerFactory = useWalletLoggerFactory()
  return useMemo(() => loggerFactory(protocol), [loggerFactory, protocol])
}

export function useWalletLogs (protocol, payInId, { poll = true, pollInterval = FAST_POLL_INTERVAL_MS, walletId } = {}) {
  const [cursor, setCursor] = useState(null)
  const [logs, setLogs] = useState([])

  // if no protocol was given, we want to fetch all logs
  const protocolId = protocol ? Number(protocol.id) : undefined
  const logFilters = useMemo(() => ({ protocolId, walletId, payInId }), [protocolId, walletId, payInId])

  // if we're configuring a protocol template, there are no logs to fetch
  const noFetch = protocol && isTemplate(protocol)
  const [fetchLogs, { called, loading, error }] = useLazyQuery(WALLET_LOGS, {
    fetchPolicy: 'network-only',
    errorPolicy: 'all'
  })

  const loadLogs = useCallback(async ({ cursor, mode } = {}) => {
    if (noFetch) return

    let data, error
    try {
      ({ data, error } = await fetchLogs({
        variables: cursor ? { ...logFilters, cursor } : logFilters
      }))
    } catch (err) {
      !isAbortError(err) && console.error(err)
      return
    }

    if (error) {
      console.error('failed to fetch wallet logs:', error.message)
      return
    }

    const { entries, cursor: nextCursor } = data.walletLogs
    if (mode === 'append') {
      setLogs(logs => [...logs, ...entries.filter(log => !logs.some(existing => existing.id === log.id))])
      setCursor(nextCursor)
      return
    }
    if (mode === 'prepend') {
      setLogs(logs => [...entries.filter(log => !logs.some(existing => existing.id === log.id)), ...logs])
      return
    }

    setLogs(entries)
    setCursor(nextCursor)
  }, [fetchLogs, logFilters, noFetch])

  useEffect(() => {
    if (noFetch) return

    setCursor(null)
    setLogs([])
    loadLogs()

    if (!poll) return

    const interval = setInterval(() => {
      loadLogs({ mode: 'prepend' })
    }, pollInterval)

    return () => clearInterval(interval)
  }, [loadLogs, noFetch, poll, pollInterval])

  const loadMore = useCallback(async () => {
    await loadLogs({ cursor, mode: 'append' })
  }, [loadLogs, cursor])

  const clearLogs = useCallback(() => {
    setLogs([])
    setCursor(null)
  }, [])

  return useMemo(() => {
    return {
      loading: noFetch ? false : (!called ? true : loading),
      logs: noFetch ? EMPTY_LOGS : logs,
      error,
      loadMore,
      hasMore: cursor !== null,
      clearLogs
    }
  }, [loading, noFetch, called, logs, error, loadMore, cursor, clearLogs])
}

export function useDeleteWalletLogs (protocol) {
  const showModal = useShowModal()

  return useCallback((callbacks = {}) => {
    showModal(onClose => <DeleteWalletLogsObstacle protocol={protocol} onClose={onClose} {...callbacks} />)
  }, [showModal, protocol])
}

function DeleteWalletLogsObstacle ({ protocol, onClose, onSuccess }) {
  const toaster = useToast()
  const [deleteWalletLogs] = useMutation(DELETE_WALLET_LOGS)

  const handleConfirm = useCallback(async () => {
    try {
      // there are no logs to delete on the server if protocol is a template
      if (!protocol || !isTemplate(protocol)) {
        await deleteWalletLogs({
          variables: { protocolId: protocol ? Number(protocol.id) : undefined }
        })
      }
      onClose()
      onSuccess?.()
      toaster.success('deleted wallet logs')
    } catch (err) {
      console.error('failed to delete wallet logs:', err)
      toaster.danger('failed to delete wallet logs')
    }
  }, [protocol, deleteWalletLogs, onClose, onSuccess, toaster])

  let prompt = 'Do you really want to delete all logs?'
  if (protocol) {
    prompt = 'Do you really want to delete all logs of this protocol?'
  }

  return (
    <div className='text-center'>
      {prompt}
      <ObstacleButtons onClose={onClose} onConfirm={handleConfirm} confirmText='delete' />
    </div>
  )
}

function mapLevelToConsole (level) {
  switch (level) {
    case 'OK':
    case 'INFO':
      return 'info'
    case 'ERROR':
      return 'error'
    case 'WARN':
    case 'WARNING':
      return 'warn'
    default:
      return 'log'
  }
}
