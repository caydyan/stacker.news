import { createContext, useCallback, useContext, useMemo, useReducer } from 'react'
import { isTemplate, protocolFormId } from '@/wallets/lib/util'
import { configureReducerWithLogging, initialConfigureState } from './reducer'

// Three contexts instead of one wide one: wallet identity is stable for the
// provider's lifetime; state changes on every action; dispatch never changes.
// Splitting them lets consumers subscribe only to what they read, so a
// dispatch from one CapabilityCard does not re-render every other consumer.
const WalletContext = createContext()
const ConfigureStateContext = createContext()
const ConfigureDispatchContext = createContext()

export function WalletConfigureFormProvider ({ wallet, children }) {
  // useReducer returns a stable state reference on no-op (handlers short-circuit
  // when nothing changes), so we don't need a memo wrapper here.
  const [state, dispatch] = useReducer(configureReducerWithLogging, wallet, initialConfigureState)

  return (
    <WalletContext.Provider value={wallet}>
      <ConfigureDispatchContext.Provider value={dispatch}>
        <ConfigureStateContext.Provider value={state}>
          {children}
        </ConfigureStateContext.Provider>
      </ConfigureDispatchContext.Provider>
    </WalletContext.Provider>
  )
}

export function useWallet () {
  return useContext(WalletContext)
}

export function useConfigureState () {
  return useContext(ConfigureStateContext)
}

export function useConfigureDispatch () {
  return useContext(ConfigureDispatchContext)
}

export function useProtocolEntry (protocol) {
  const formId = protocolFormId(protocol)
  const { entries } = useConfigureState()
  return entries[formId]
}

export function useWalletProtocols (send) {
  const wallet = useWallet()

  const protocolFilter = useCallback(p => p.send === send, [send])

  return useMemo(() => {
    // all protocols are templates if wallet is a template
    if (isTemplate(wallet)) {
      return wallet.protocols.filter(protocolFilter)
    }
    // return template for every protocol that isn't configured
    const configured = wallet.protocols.filter(protocolFilter)
    const templates = wallet.template.protocols.filter(protocolFilter)
    return templates.map(p => configured.find(c => c.name === p.name) ?? p)
  }, [wallet, protocolFilter])
}
