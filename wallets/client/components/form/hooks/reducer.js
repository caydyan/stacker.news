import { isTemplate, protocolFields, protocolFormId } from '@/wallets/lib/util'
import {
  emptyDisabledEntry,
  entryValuesKey,
  hasMeaningfulConfig,
  isSavedProtocol,
  protocolFromFormValues
} from './protocol'

export const TestStatus = {
  SAVED: 'saved',
  TESTED: 'tested',
  NEEDS_TEST: 'needs_test',
  TESTING: 'testing',
  FAILED: 'failed',
  NOT_SET: 'not_set'
}

export const SAVEABLE_TEST_STATUSES = new Set([
  TestStatus.SAVED,
  TestStatus.TESTED
])

export const DIRTY_TEST_STATUSES = new Set([
  TestStatus.NEEDS_TEST,
  TestStatus.TESTING,
  TestStatus.FAILED
])

// Configure reducer state:
// - entries holds the live per-form values, keyed by protocolFormId(protocol).
//   VALUES_CHANGED writes through on every keystroke; commit events (test pass,
//   toggle, NWC bridge) bump commitGeneration so Formik can sync back.
// - testResults is an append-mostly log keyed by values key.
// - savedKeys is seeded from persisted protocols and never rewritten.
// - inFlightTests marks the values key currently being tested for a formId.
// - commitGeneration bumps per formId on commit events; the Formik sync effect
//   in capability-card observes it to push reducer-driven values back into the
//   form without stomping in-progress typing.
export function initialConfigureState (wallet) {
  const entries = isTemplate(wallet)
    ? {}
    : Object.fromEntries(wallet.protocols.map(protocol => [protocolFormId(protocol), protocol]))

  const savedKeys = new Map(
    Object.entries(entries)
      .filter(([, protocol]) => hasMeaningfulConfig(protocol))
      .map(([formId, protocol]) => [formId, entryValuesKey(protocol, wallet)])
  )

  return {
    wallet,
    entries,
    testResults: new Map(),
    savedKeys,
    inFlightTests: new Map(),
    removedFormIds: new Set(),
    commitGeneration: new Map()
  }
}

export function configureReducer (state, action) {
  switch (action.type) {
    case 'UNSAVED_FORMS_CLEARED':
      return dropUnsavedDrafts(state, action.formIds)

    case 'VALUES_CHANGED':
      return valuesChanged(state, action)

    case 'TEST_STARTED':
      return startTest(state, action)

    case 'TEST_PASSED':
      return testPassed(state, action)

    case 'TEST_FAILED':
      return testFailed(state, action)

    case 'RECORD_VALIDATION_FAILURE':
      return markFailed(state, action)

    case 'TOGGLE':
      return toggle(state, action)

    case 'METHOD_SWITCHED':
      return methodSwitched(state, action)

    case 'PROTOCOL_REMOVED':
      return protocolRemoved(state, action.formId)

    case 'NWC_LUD16_BRIDGE':
      return nwcLud16Bridge(state, action)

    default:
      return state
  }
}

export const configureReducerWithLogging = process.env.NODE_ENV === 'development'
  ? (state, action) => {
      const next = configureReducer(state, action)
      console.groupCollapsed(`[wallet-configure] ${action.type}`)
      console.log('action', action)
      console.log('diff', diffState(state, next))
      console.groupEnd()
      return next
    }
  : configureReducer

function valuesChanged (state, { formId, protocol, values }) {
  const candidate = protocolFromFormValues(protocol, values, state.wallet)
  const hasValues = hasMeaningfulConfig(candidate)
  const entry = hasValues ? candidate : emptyDisabledEntry(protocol)
  const next = setProtocolEntry(state, formId, entry, { commit: false })
  // Erasing the form clears any in-flight test for it; the user is backing out.
  if (!hasValues && next.inFlightTests.has(formId)) {
    return { ...next, inFlightTests: deleteFrom(next.inFlightTests, formId) }
  }
  return next
}

function startTest (state, { formId, valuesKey }) {
  return { ...state, inFlightTests: setIn(state.inFlightTests, formId, valuesKey) }
}

function testPassed (state, { formId, committedKey, testKey = committedKey, committedValues, protocol }) {
  if (state.inFlightTests.get(formId) !== testKey) return state
  // The user may have edited the form to a different value while the test was
  // running. Only commit the tested values if the current entry still matches
  // what was tested; otherwise just record the result and clear the in-flight
  // marker so the late ack cannot clobber the user's latest input. They can
  // still revert to the passed values and selectStatus will read TESTED out of
  // testResults.
  const currentEntry = state.entries[formId]
  if (currentEntry && entryValuesKey(currentEntry, state.wallet) !== testKey) {
    return {
      ...state,
      testResults: setIn(state.testResults, committedKey, { outcome: 'passed' }),
      inFlightTests: deleteFrom(state.inFlightTests, formId)
    }
  }
  const entry = protocolFromFormValues(protocol, committedValues, state.wallet)
  const next = setProtocolEntry(state, formId, entry, { commit: true })
  return { ...next, testResults: setIn(next.testResults, committedKey, { outcome: 'passed' }) }
}

function testFailed (state, action) {
  if (state.inFlightTests.get(action.formId) !== action.valuesKey) return state
  return markFailed(state, action)
}

function markFailed (state, { formId, valuesKey, error, details }) {
  return {
    ...state,
    testResults: setIn(state.testResults, valuesKey, { outcome: 'failed', error, details }),
    inFlightTests: deleteFrom(state.inFlightTests, formId)
  }
}

function toggle (state, { formId, enabled, values, protocol }) {
  const entry = protocolFromFormValues(protocol, { ...values, enabled }, state.wallet)
  const next = setProtocolEntry(state, formId, entry, { commit: true })
  // Fieldless protocols (WebLN) have no config to persist disabled. Saving
  // "disabled" is meaningless server-side; saving means removing the row.
  if (!enabled && protocolFields(protocol).length === 0 && isSavedProtocol(state.entries[formId])) {
    return { ...next, removedFormIds: addTo(next.removedFormIds, formId) }
  }
  return next
}

function methodSwitched (state, { siblingFormIds }) {
  return dropUnsavedDrafts(state, siblingFormIds)
}

function protocolRemoved (state, formId) {
  const protocol = state.entries[formId]
  const removedFormIds = isSavedProtocol(protocol)
    ? addTo(state.removedFormIds, formId)
    : state.removedFormIds

  let next = deleteProtocolEntry({ ...state, removedFormIds }, formId)
  next = {
    ...next,
    inFlightTests: deleteFrom(next.inFlightTests, formId)
  }
  return next
}

function nwcLud16Bridge (state, { formId, protocol, config }) {
  // appendLightningAddressDomain inside protocolFromFormValues is a no-op for
  // addresses already containing `@`, which is the only shape the bridge sends.
  const entry = protocolFromFormValues(protocol, { enabled: true, ...config }, state.wallet)
  return setProtocolEntry(state, formId, entry, { commit: true })
}

function setProtocolEntry (state, formId, entry, { commit }) {
  const entries = { ...state.entries, [formId]: entry }
  const removedFormIds = hasMeaningfulConfig(entry)
    ? deleteFrom(state.removedFormIds, formId)
    : state.removedFormIds
  const inFlightTests = commit ? deleteFrom(state.inFlightTests, formId) : state.inFlightTests
  const commitGeneration = commit
    ? setIn(state.commitGeneration, formId, (state.commitGeneration.get(formId) ?? 0) + 1)
    : state.commitGeneration
  return { ...state, entries, removedFormIds, inFlightTests, commitGeneration }
}

function dropUnsavedDrafts (state, formIds) {
  let next = state
  for (const formId of formIds) {
    if (isSavedProtocol(next.entries[formId])) continue
    next = deleteProtocolEntry(next, formId)
    next = {
      ...next,
      inFlightTests: deleteFrom(next.inFlightTests, formId)
    }
  }
  return next
}

function deleteProtocolEntry (state, formId) {
  if (!Object.prototype.hasOwnProperty.call(state.entries, formId)) return state
  const { [formId]: _removed, ...entries } = state.entries
  return { ...state, entries }
}

function setIn (map, id, value) {
  if (map.get(id) === value) return map
  const next = new Map(map)
  next.set(id, value)
  return next
}

function addTo (set, id) {
  if (set.has(id)) return set
  const next = new Set(set)
  next.add(id)
  return next
}

function deleteFrom (mapOrSet, id) {
  if (!mapOrSet.has(id)) return mapOrSet
  const next = new mapOrSet.constructor(mapOrSet)
  next.delete(id)
  return next
}

function diffState (previous, next) {
  return Object.keys(next).reduce((diff, key) => {
    if (previous?.[key] !== next[key]) diff[key] = { before: previous?.[key], after: next[key] }
    return diff
  }, {})
}
