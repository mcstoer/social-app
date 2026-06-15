import {createContext, useContext, useMemo, useState} from 'react'

export type PostLoginStep =
  | {type: 'update-verusid-credentials'; password: string}
  | {type: 'remove-verusid-account-link'}
  | {type: 'check-verusid-account-link'}

type State = {
  // Track the current did that is associated with the steps so we can clear it
  // if the session changes away.
  ownerDid: string | undefined
  steps: PostLoginStep[]
}

// API for the post login step queue.
type Api = {
  initialize: (steps: PostLoginStep[]) => void
  // Associates the queue with a given did.
  claim: (did: string) => void
  advance: () => void
  clear: () => void
}

const EMPTY: State = {ownerDid: undefined, steps: []}

const StateContext = createContext<State>(EMPTY)
StateContext.displayName = 'PostLoginStepsStateContext'

const ApiContext = createContext<Api>({
  initialize: () => {},
  claim: () => {},
  advance: () => {},
  clear: () => {},
})
ApiContext.displayName = 'PostLoginStepsApiContext'

export function Provider({children}: React.PropsWithChildren<{}>) {
  const [state, setState] = useState<State>(EMPTY)

  const api = useMemo<Api>(
    () => ({
      initialize: steps => {
        setState({ownerDid: undefined, steps})
      },
      claim: did => {
        setState(prev =>
          prev.steps.length && prev.ownerDid === undefined
            ? {ownerDid: did, steps: prev.steps}
            : prev,
        )
      },
      advance: () => {
        setState(prev =>
          prev.steps.length
            ? {ownerDid: prev.ownerDid, steps: prev.steps.slice(1)}
            : prev,
        )
      },
      clear: () => {
        setState(prev =>
          prev.steps.length || prev.ownerDid !== undefined ? EMPTY : prev,
        )
      },
    }),
    [],
  )

  return (
    <StateContext.Provider value={state}>
      <ApiContext.Provider value={api}>{children}</ApiContext.Provider>
    </StateContext.Provider>
  )
}

export function usePostLoginSteps() {
  return useContext(StateContext)
}

export function usePostLoginStepsApi() {
  return useContext(ApiContext)
}
