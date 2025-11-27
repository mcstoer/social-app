import {useQuery} from '@tanstack/react-query'

import {useVerusService} from '#/state/preferences'
import {STALE} from '#/state/queries'

export const createVerusGetIdentityQueryKey = (identity: string) => [
  'verus-getidentity',
  identity,
]

export function useVerusGetIdentityQuery({identity}: {identity: string}) {
  const {verusRpcInterface} = useVerusService()

  return useQuery({
    staleTime: STALE.MINUTES.ONE,
    queryKey: createVerusGetIdentityQueryKey(identity),
    queryFn: async () => {
      const data = await verusRpcInterface.getIdentity(identity)
      return data
    },
  })
}
