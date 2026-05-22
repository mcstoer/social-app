import {useQuery, useQueryClient} from '@tanstack/react-query'
import {type IdentityDefinition} from 'verus-typescript-primitives'

import {useVerusService} from '#/state/preferences'
import {STALE} from '#/state/queries'

export const createVerusGetIdentityQueryKey = (identity: string) => [
  'verus-getidentity',
  identity,
]

export type VerusGetIdentityQueryResult = {
  identity: IdentityDefinition
}

export function useVerusGetIdentity() {
  const queryClient = useQueryClient()
  const {verusRpcInterface} = useVerusService()

  return async (identity: string): Promise<VerusGetIdentityQueryResult> => {
    const res = await queryClient.fetchQuery({
      staleTime: STALE.MINUTES.ONE,
      queryKey: createVerusGetIdentityQueryKey(identity),
      queryFn: async () => {
        return await verusRpcInterface.getIdentity(identity)
      },
    })
    // Return just the identity to make it easier for callers.
    if (res.error) throw new Error(res.error.message)
    return {identity: res.result.identity}
  }
}

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
