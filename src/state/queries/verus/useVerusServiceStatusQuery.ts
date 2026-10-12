import {useQuery} from '@tanstack/react-query'

import {useVerusService} from '#/state/preferences'
import {STALE} from '#/state/queries'

export const RQKEY = (url: string, system: string) => [
  'verus-service-status',
  url,
  system,
]

export function useVerusServiceStatusQuery() {
  const {verusRpcInterface, state} = useVerusService()

  return useQuery({
    staleTime: STALE.SECONDS.FIFTEEN,
    queryKey: RQKEY(state.url, state.system),
    async queryFn() {
      const info = await verusRpcInterface.getInfo()
      if (info.error) {
        return {connected: false}
      }
      return {connected: true}
    },
  })
}
