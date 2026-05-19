import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react'
import {VerusdRpcInterface} from 'verusd-rpc-ts-client'
import {VerusIdInterface} from 'verusid-ts-client'

import * as persisted from '#/state/persisted'

type VerusServicePreferences = persisted.Schema['verusServiceInterface']

type StateContext = {
  state: VerusServicePreferences
  verusRpcInterface: VerusdRpcInterface
  verusIdInterface: VerusIdInterface
}

type SetContext = (settings: VerusServicePreferences) => void

const createAxiosConfig = (preferences: VerusServicePreferences) => {
  return preferences.auth
    ? {
        auth: {
          username: preferences.auth.username,
          password: preferences.auth.password,
        },
      }
    : undefined
}

const createVerusdRpcInterface = (preferences: VerusServicePreferences) => {
  return new VerusdRpcInterface(
    preferences.system,
    preferences.url,
    createAxiosConfig(preferences),
  )
}

const createVerusIdInterface = (preferences: VerusServicePreferences) => {
  return new VerusIdInterface(
    preferences.system,
    preferences.url,
    createAxiosConfig(preferences),
  )
}

const stateContext = createContext<StateContext>({
  state: persisted.defaults.verusServiceInterface,
  verusRpcInterface: createVerusdRpcInterface(
    persisted.defaults.verusServiceInterface,
  ),
  verusIdInterface: createVerusIdInterface(
    persisted.defaults.verusServiceInterface,
  ),
})
stateContext.displayName = 'VerusServiceStateContext'

const setContext = createContext<SetContext>((_: VerusServicePreferences) => {})
setContext.displayName = 'VerusServiceSetContext'

export function Provider({children}: PropsWithChildren<{}>) {
  const [state, setState] = useState<VerusServicePreferences>(
    persisted.get('verusServiceInterface'),
  )

  const interfaces = {
    state,
    verusRpcInterface: createVerusdRpcInterface(state),
    verusIdInterface: createVerusIdInterface(state),
  }

  const setStateWrapped = (preferences: VerusServicePreferences) => {
    setState(preferences)
    void persisted.write('verusServiceInterface', preferences)
  }

  useEffect(() => {
    return persisted.onUpdate(
      'verusServiceInterface',
      nextServicePreferences => {
        setState(nextServicePreferences)
      },
    )
  }, [])

  return (
    <stateContext.Provider value={interfaces}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useVerusService() {
  return useContext(stateContext)
}

export function useSetVerusServicePreferences() {
  return useContext(setContext)
}
