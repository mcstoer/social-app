import {useQuery} from '@tanstack/react-query'
import {
  Credential,
  IDENTITY_CREDENTIAL_PLAINLOGIN,
  type IdentityDefinition,
  LoginConsentResponse,
} from 'verus-typescript-primitives'
import {type VerusdRpcInterface} from 'verusd-rpc-ts-client'

import {LOCAL_DEV_VSKY_SERVER} from '#/lib/constants'

export interface VerusIdLoginResult {
  loginResponse: LoginConsentResponse
  identity: IdentityDefinition
  credentials: {
    username: string
    password: string
  }
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

  // Extract credentials from the login response
  const context = loginResponse.decision.context
  const credentialHex = context?.kv[IDENTITY_CREDENTIAL_PLAINLOGIN.vdxfid]

  if (!credentialHex) {
    throw new Error('Missing login credentials in VerusSky response')
  }

  const credential = new Credential()
  credential.fromBuffer(Buffer.from(credentialHex, 'hex'))
  const plainLogin = credential.credential

  if (!plainLogin || !Array.isArray(plainLogin) || plainLogin.length < 2) {
    if (!plainLogin || !Array.isArray(plainLogin)) {
      throw new Error('Invalid credential format')
    } else if (!plainLogin[0]) {
      throw new Error('Missing username in credentials')
    } else if (!plainLogin[1]) {
      throw new Error('Missing password in credentials')
    }
    throw new Error('Invalid credentials')
  }

  const identity = identityResponse.result.identity

  return {
    loginResponse,
    identity,
    credentials: {
      username: plainLogin[0],
      password: plainLogin[1],
    },
  }
}

export const createVerusIdLoginQueryKey = (requestId: string) => [
  'verusid-login',
  requestId,
]

export function useVerusIdLoginQuery({
  requestId,
  verusRpcInterface,
  enabled = true,
}: {
  requestId: string
  verusRpcInterface: VerusdRpcInterface
  enabled?: boolean
}) {
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
