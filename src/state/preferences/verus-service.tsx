import React from 'react'
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

const stateContext = React.createContext<StateContext>({
  state: persisted.defaults.verusServiceInterface,
  verusRpcInterface: createVerusdRpcInterface(
    persisted.defaults.verusServiceInterface,
  ),
  verusIdInterface: createVerusIdInterface(
    persisted.defaults.verusServiceInterface,
  ),
})
stateContext.displayName = 'VerusServiceStateContext'

const setContext = React.createContext<SetContext>(
  (_: VerusServicePreferences) => {},
)
setContext.displayName = 'VerusServiceSetContext'

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = React.useState<VerusServicePreferences>(
    persisted.get('verusServiceInterface'),
  )

  const interfaces = React.useMemo(() => {
    return {
      state,
      verusRpcInterface: createVerusdRpcInterface(state),
      verusIdInterface: createVerusIdInterface(state),
    }
  }, [state])

  const setStateWrapped = React.useCallback(
    (preferences: VerusServicePreferences) => {
      setState(preferences)
      persisted.write('verusServiceInterface', preferences)
    },
    [],
  )

  React.useEffect(() => {
    return persisted.onUpdate(
      'verusServiceInterface',
      nextServicePreferences => {
        setState(nextServicePreferences)
      },
    )
  }, [setStateWrapped])

  return (
    <stateContext.Provider value={interfaces}>
      <setContext.Provider value={setStateWrapped}>
        {children}
      </setContext.Provider>
    </stateContext.Provider>
  )
}

export function useVerusService() {
  return React.useContext(stateContext)
}

export function useSetVerusServicePreferences() {
  return React.useContext(setContext)
}
