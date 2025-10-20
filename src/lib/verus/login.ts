import {
  Credential,
  IDENTITY_CREDENTIAL_PLAINLOGIN,
  type LoginConsentResponse,
} from 'verus-typescript-primitives'

export function parseVerusIdLogin(login: LoginConsentResponse): {
  username: string
  password: string
} {
  // The credentials are stored as hex within the decision's context.
  const context = login.decision.context
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

  return {
    username: plainLogin[0],
    password: plainLogin[1],
  }
}
