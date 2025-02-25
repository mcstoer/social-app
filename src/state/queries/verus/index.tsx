import React from 'react'

import type {VerusDaemonApiContext} from '#/state/queries/verus/types'
import {callRPCDaemon} from '#/state/queries/verus/util'

const apiContext = React.createContext<VerusDaemonApiContext>({
  callDaemon: async () => {
    throw new Error('Missing VerusDaemonProvider')
  },
})

export function Provider({
  children,
  url,
}: React.PropsWithChildren<{url: string}>) {
  const callDaemon = React.useCallback(
    async (command: string, params?: (string | object)[]) => {
      return callRPCDaemon(url, command, params)
    },
    [url],
  )

  const api = React.useMemo(() => ({callDaemon}), [callDaemon])

  return <apiContext.Provider value={api}>{children}</apiContext.Provider>
}

export function useVerusDaemonApi() {
  return React.useContext(apiContext)
}
