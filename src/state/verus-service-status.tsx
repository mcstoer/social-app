import {createContext, useContext, useMemo} from 'react'

import {useVerusServiceStatusQuery} from '#/state/queries/verus/useVerusServiceStatusQuery'

export type VerusServiceStatus = 'unknown' | 'connected' | 'disconnected'

const VerusServiceStatusContext = createContext<VerusServiceStatus>('unknown')
VerusServiceStatusContext.displayName = 'VerusServiceStatusContext'

export function Provider({children}: {children: React.ReactNode}) {
  const {data: daemonData, isPending: isDaemonPending} =
    useVerusServiceStatusQuery()

  const status = useMemo<VerusServiceStatus>(() => {
    if (daemonData?.connected === false || isDaemonPending) {
      return 'disconnected'
    }
    if (isDaemonPending) {
      return 'unknown'
    }
    if (daemonData?.connected) {
      return 'connected'
    }
    return 'disconnected'
  }, [isDaemonPending, daemonData])

  return (
    <VerusServiceStatusContext.Provider value={status}>
      {children}
    </VerusServiceStatusContext.Provider>
  )
}

export function useVerusServiceStatus() {
  return useContext(VerusServiceStatusContext)
}

export function useVerusActionsUnavailable() {
  const status = useContext(VerusServiceStatusContext)
  return status === 'disconnected'
}
