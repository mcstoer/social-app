import {useQuery} from '@tanstack/react-query'
import {IdentityUpdateResponse} from 'verus-typescript-primitives'

import {LOCAL_DEV_VSKY_SERVER} from '#/lib/constants'

export async function getVerusIdUpdate({
  requestId,
}: {
  requestId: string
}): Promise<IdentityUpdateResponse | null> {
  const response = await fetch(
    `${LOCAL_DEV_VSKY_SERVER}/api/v1/identityupdates/get-credential-update-response?requestId=${encodeURIComponent(
      requestId,
    )}`,
  )

  // Occurs when the update server hasn't received a response yet
  if (response.status === 204) {
    return null
  }

  if (!response.ok) {
    throw new Error('Failed to fetch VerusID update response')
  }

  const data = await response.json()
  const updateResponse = IdentityUpdateResponse.fromJson(data)

  return updateResponse
}

export const createVerusIdUpdateQueryKey = (requestId: string) => [
  'verusid-update',
  requestId,
]

export function useVerusIdUpdateQuery({
  requestId,
  enabled = true,
}: {
  requestId: string
  enabled?: boolean
}) {
  return useQuery({
    enabled: !!requestId && enabled !== false,
    queryKey: createVerusIdUpdateQueryKey(requestId),
    queryFn: async () => {
      return await getVerusIdUpdate({requestId})
    },
    refetchInterval: query => {
      return query.state.data ? false : 1000
    },
    staleTime: 0,
    retry: false,
  })
}
