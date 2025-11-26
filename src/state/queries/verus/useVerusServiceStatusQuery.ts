import {useQuery} from '@tanstack/react-query'

import {useVerusService} from '#/state/preferences'
import {STALE} from '#/state/queries'

export const RQKEY = () => ['verus-service-status']

export function useVerusServiceStatusQuery() {
  const {verusRpcInterface} = useVerusService()

  return useQuery({
    staleTime: STALE.SECONDS.FIFTEEN,
    queryKey: RQKEY(),
    async queryFn() {
      const info = await verusRpcInterface.getInfo()
      if (info.error) {
        return {connected: false}
      }
      return {connected: true}
    },
  })
}
