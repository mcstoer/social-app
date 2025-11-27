import {useQuery} from '@tanstack/react-query'
import {
  type IdentityDefinition,
  LoginConsentResponse,
} from 'verus-typescript-primitives'
import {type VerusdRpcInterface} from 'verusd-rpc-ts-client'

import {LOCAL_DEV_VSKY_SERVER} from '#/lib/constants'
import {useVerusService} from '#/state/preferences'

export interface VerusIdLoginResult {
  loginResponse: LoginConsentResponse
  identity: IdentityDefinition
}

export async function getVerusIdLogin({
  requestId,
  verusRpcInterface,
}: {
  requestId: string
  verusRpcInterface: VerusdRpcInterface
}): Promise<VerusIdLoginResult | null> {
  const response = await fetch(
    `${LOCAL_DEV_VSKY_SERVER}/api/v1/login/get-login-response?requestId=${encodeURIComponent(
      requestId,
    )}`,
  )

  // Occurs when the login server hasn't received a recent login.
  if (response.status === 204) {
    return null
  }

  if (!response.ok) {
    throw new Error('Failed to fetch VerusID login response')
  }

  const res = await response.json()
  const loginResponse = new LoginConsentResponse(res)

  const identityResponse = await verusRpcInterface.getIdentity(
    loginResponse.signing_id,
  )

  if (!identityResponse.result) {
    throw new Error('Unable to fetch details on the signing identity')
  }

  const identity = identityResponse.result.identity

  return {
    loginResponse,
    identity,
  }
}

export const createVerusIdLoginQueryKey = (requestId: string) => [
  'verusid-login',
  requestId,
]

export function useVerusIdLoginQuery({
  requestId,
  enabled = true,
}: {
  requestId: string
  enabled?: boolean
}) {
  const {verusRpcInterface} = useVerusService()

  return useQuery({
    enabled: !!requestId && enabled !== false,
    queryKey: createVerusIdLoginQueryKey(requestId),
    queryFn: async () => {
      return await getVerusIdLogin({requestId, verusRpcInterface})
    },
    refetchInterval: query => {
      return query.state.data ? false : 1000
    },
    staleTime: 0,
    retry: false,
  })
}
