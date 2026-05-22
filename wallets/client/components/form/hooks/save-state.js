import { isWallet, protocolFormId } from '@/wallets/lib/util'
import { DIRTY_TEST_STATUSES, SAVEABLE_TEST_STATUSES, TestStatus } from './reducer'
import { entryValuesKey, hasMeaningfulConfig } from './protocol'

export function selectStatus (state, formId) {
  const protocol = state.entries[formId]
  const meaningful = hasMeaningfulConfig(protocol)

  if (protocol?.enabled === false && meaningful) return TestStatus.SAVED
  if (!meaningful) return TestStatus.NOT_SET

  const key = entryValuesKey(protocol, state.wallet)
  if (state.inFlightTests.get(formId) === key) return TestStatus.TESTING
  if (state.savedKeys.get(formId) === key) return TestStatus.SAVED

  const result = state.testResults.get(key)
  if (result?.outcome === 'passed') return TestStatus.TESTED
  if (result?.outcome === 'failed') return TestStatus.FAILED

  return TestStatus.NEEDS_TEST
}

export function selectTestError (state, formId) {
  const protocol = state.entries[formId]
  if (!hasMeaningfulConfig(protocol)) return null

  const key = entryValuesKey(protocol, state.wallet)
  const result = state.testResults.get(key)
  return result?.outcome === 'failed' ? { error: result.error, details: result.details } : null
}

export function selectCanSave (state, formId) {
  return SAVEABLE_TEST_STATUSES.has(selectStatus(state, formId))
}

export function selectWalletConfigureSaveState (state) {
  const { entries, removedFormIds, wallet } = state
  const meaningful = Object.values(entries).filter(hasMeaningfulConfig)
  const configured = meaningful.filter(p => p.enabled !== false)
  const pendingRemoval = isWallet(wallet)
    ? wallet.protocols.filter(p => removedFormIds.has(protocolFormId(p)))
    : []
  const willDeleteWallet = isWallet(wallet) &&
    wallet.protocols.length === pendingRemoval.length &&
    configured.length === 0

  const trackedFormIds = new Set([
    ...Object.keys(entries),
    ...state.inFlightTests.keys()
  ])

  const blocker = (() => {
    for (const formId of trackedFormIds) {
      const status = selectStatus(state, formId)
      if (DIRTY_TEST_STATUSES.has(status)) return statusBlockerMessage(status)
    }
    if (meaningful.length === 0 && pendingRemoval.length === 0) {
      return 'configure at least one capability'
    }
    const unready = meaningful.find(p => !selectCanSave(state, protocolFormId(p)))
    return unready ? `test ${unready.send ? 'send' : 'receive'} before saving` : null
  })()

  const saveStatus = blocker ??
    (willDeleteWallet ? 'saving will delete this wallet because no capabilities remain' : 'ready to save')

  return {
    canSave: !blocker,
    blocker,
    configuredProtocols: configured,
    pendingRemovalProtocols: pendingRemoval,
    hasConfiguredCapability: meaningful.length > 0,
    hasPendingRemoval: pendingRemoval.length > 0,
    willDeleteWallet,
    saveStatus,
    saveButtonLabel: willDeleteWallet ? 'save and delete wallet' : 'save wallet'
  }
}

export function statusBlockerMessage (status) {
  if (status === TestStatus.TESTING) return 'wait for test to finish'
  if (status === TestStatus.FAILED) return 'fix failed test before saving'
  return 'run capability tests before saving'
}
