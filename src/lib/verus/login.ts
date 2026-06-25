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
    throw new Error('Missing sign in credentials in VerusSky response')
  }

  const credential = new Credential()
  credential.fromBuffer(Buffer.from(credentialHex, 'hex'))
  const plainLogin = credential.credential

  if (!Array.isArray(plainLogin) || plainLogin.length < 2) {
    throw new Error('Invalid credential format')
  }

  const [username, password] = plainLogin

  if (typeof username !== 'string') {
    throw new Error('Invalid username format')
  }
  if (typeof password !== 'string') {
    throw new Error('Invalid password format')
  }

  if (username.trim().length === 0) {
    throw new Error('Missing username in credentials')
  }
  if (password.trim().length === 0) {
    throw new Error('Missing password in credentials')
  }

  return {
    username,
    password,
  }
}
