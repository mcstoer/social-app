import {useQuery} from '@tanstack/react-query'
import {type VerusdRpcInterface} from 'verusd-rpc-ts-client'

import {STALE} from '#/state/queries'

export const createVerusGetIdentityQueryKey = (identity: string) => [
  'verus-getidentity',
  identity,
]

export function useVerusGetIdentityQuery({
  identity,
  rpcInferface,
}: {
  identity: string
  rpcInferface: VerusdRpcInterface
}) {
  return useQuery({
    staleTime: STALE.MINUTES.ONE,
    queryKey: createVerusGetIdentityQueryKey(identity),
    queryFn: async () => {
      const data = await rpcInferface.getIdentity(identity)
      return data
    },
  })
}
