import {useQuery} from '@tanstack/react-query'
import {GenericResponse} from 'verus-typescript-primitives'
import {type VerusIdInterface} from 'verusid-ts-client'

import {LOCAL_DEV_VSKY_SERVER} from '#/lib/constants'
import {useVerusService} from '#/state/preferences'

const RESPONSES_GET_ENDPOINT = `${LOCAL_DEV_VSKY_SERVER}/api/v2/responses/get`

export async function getVerusIdRequestResponse({
  requestId,
  verusIdInterface,
}: {
  requestId: string
  verusIdInterface: VerusIdInterface
}): Promise<GenericResponse | null> {
  const response = await fetch(
    `${RESPONSES_GET_ENDPOINT}?requestId=${encodeURIComponent(requestId)}`,
  )

  // Occurs when the server hasn't received a response yet
  if (response.status === 204) {
    return null
  }

  if (!response.ok) {
    throw new Error('Failed to fetch VerusID request response')
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const genericResponse = new GenericResponse()
  genericResponse.fromBuffer(buffer)

  const isValid = await verusIdInterface.verifyGenericResponse(genericResponse)

  if (!isValid) {
    throw new Error('Invalid VerusID request response')
  }

  return genericResponse
}

export const createVerusIdRequestQueryKey = (requestId: string) => [
  'verusid-request',
  requestId,
]

export function useVerusIdRequestQuery({
  requestId,
  enabled = true,
}: {
  requestId: string
  enabled?: boolean
}) {
  const {verusIdInterface} = useVerusService()
  return useQuery({
    enabled: !!requestId && enabled !== false,
    queryKey: createVerusIdRequestQueryKey(requestId),
    queryFn: async () => {
      return await getVerusIdRequestResponse({requestId, verusIdInterface})
    },
    refetchInterval: query => {
      return query.state.data ? false : 1000
    },
    staleTime: 0,
    retry: false,
  })
}
