import {useQuery} from '@tanstack/react-query'
import {type GenericRequest} from 'verus-typescript-primitives'

import {
  type EncryptionKeysResponse,
  processEncryptionKeysResponse,
} from '#/lib/verus/requests/encryptionKeys'
import {useVerusService} from '#/state/preferences'
import {getVerusIdRequestResponse} from './useVerusIdRequestQuery'

export const createGetEncryptionKeysQueryKey = (requestId: string) => [
  'verus-get-encryption-keys',
  requestId,
]

export function useGetEncryptionKeysQuery({
  request,
  ivk,
  enabled = true,
}: {
  request: GenericRequest | null
  ivk: Buffer | null
  enabled?: boolean
}) {
  const {verusIdInterface} = useVerusService()
  const requestId = request?.requestID?.toAddress() ?? ''

  return useQuery<EncryptionKeysResponse | null>({
    enabled: enabled && !!request && !!ivk && !!requestId,
    queryKey: createGetEncryptionKeysQueryKey(requestId),
    queryFn: async () => {
      const response = await getVerusIdRequestResponse({
        requestId,
        verusIdInterface,
      })

      if (!response) {
        return null
      }

      return await processEncryptionKeysResponse(request!, response, ivk!)
    },
    refetchInterval: query => (query.state.data ? false : 1000),
    staleTime: 0,
    retry: false,
  })
}
