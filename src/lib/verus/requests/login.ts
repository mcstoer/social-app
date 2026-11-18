import {
  type AppEncryptionRequestOrdinalVDXFObject,
  type AuthenticationRequestOrdinalVDXFObject,
  Credential,
  DATA_TYPE_OBJECT_CREDENTIAL,
  type DataResponseOrdinalVDXFObject,
  type GenericRequest,
  type GenericResponse,
  IDENTITY_CREDENTIAL_PLAINLOGIN,
  type IdentityDefinition,
  type SaplingPaymentAddress,
  UserDataRequestDetails,
  UserDataRequestOrdinalVDXFObject,
  VdxfUniValue,
} from 'verus-typescript-primitives'

import {type VerusGetIdentityQueryResult} from '#/state/queries/verus/useVerusGetIdentityQuery'
import {
  extractAppEncryptionKeys,
  generateAppEncryptionRequestOrdinal,
} from './details/appEncryptionDetail'
import {
  type AuthenticationRequestOptions,
  generateAuthenticationRequestOrdinal,
} from './details/authDetail'
import {
  generateUserDataRequestOrdinal,
  type UserDataRequestOptions,
} from './details/userDataDetail'
import {
  assertResponseMatchesRequest,
  buildDataResponseMap,
  decryptResponseDetails,
} from './genericResponse'

export interface LoginRequestOptions {
  auth?: AuthenticationRequestOptions
}

export interface LoginCredentials {
  username: string
  password: string
  label?: string
}

export interface LoginResponse {
  identity: IdentityDefinition
  encryptionKey: SaplingPaymentAddress
  decryptionKey: Buffer

  credentials?: LoginCredentials[]
  credentialError?: string
}

export interface LoginRequestOrdinals {
  ordinals: [
    AuthenticationRequestOrdinalVDXFObject,
    UserDataRequestOrdinalVDXFObject,
    AppEncryptionRequestOrdinalVDXFObject,
  ]
  ivk: Buffer
  // Wallets must encrypt a reply with credentials. Send it to the same
  // one-time address as the encryption keys, so the one ivk opens both.
  encryptResponseToAddress: SaplingPaymentAddress
}

export async function generateLoginRequestOrdinals(
  options?: LoginRequestOptions,
): Promise<LoginRequestOrdinals> {
  const authentication = generateAuthenticationRequestOrdinal(options?.auth)

  const loginCredentials: UserDataRequestOptions = {
    searchDataKey: [
      {[IDENTITY_CREDENTIAL_PLAINLOGIN.vdxfid]: 'Login Credentials'},
    ],
    dataType: UserDataRequestDetails.FULL_DATA,
    requestType: UserDataRequestDetails.CREDENTIAL,
  }

  const credentialOrdinal = generateUserDataRequestOrdinal(loginCredentials)

  const {
    ordinal: appEncryptionOrdinal,
    ivk,
    encryptResponseToAddress,
  } = await generateAppEncryptionRequestOrdinal()

  return {
    ordinals: [authentication, credentialOrdinal, appEncryptionOrdinal],
    ivk,
    encryptResponseToAddress,
  }
}

export async function processLoginResponse(
  request: GenericRequest,
  signedResponse: GenericResponse,
  getIdentity: (identity: string) => Promise<VerusGetIdentityQueryResult>,
  ivk: Buffer,
): Promise<LoginResponse> {
  assertResponseMatchesRequest(request, signedResponse)
  // Verus Mobile and Verus Desktop encrypt the details to the request's address;
  // an unencrypted reply is refused.
  const response = await decryptResponseDetails(request, signedResponse, ivk)

  // remove auth ordinal

  // Process the response and details to allow for simple data to the UI.
  const signature = response.signature

  if (!signature) {
    throw new Error('Missing signature in VerusID response')
  }

  // Prepare the data response details in a map for quick lookup against the
  // request IDs in the request.
  const dataResponseMap = buildDataResponseMap(response)

  const signingAddress = signature.identityID.toIAddress()
  const getIdentityPromise = getIdentity(signingAddress)

  // If getting the keys fails, then the whole login should fail.
  const keysPromise = extractAppEncryptionKeys({
    request,
    dataResponseMap,
    ivk,
  })

  const [getIdentityResult, keysResult] = await Promise.all([
    getIdentityPromise,
    keysPromise,
  ])
  const signingIdentity = getIdentityResult.identity
  const {encryptionKey, decryptionKey} = keysResult

  // Allow for VerusID login with invalid credentials so that the user can easily update
  // their stored credentials after a manual login.
  try {
    return {
      identity: signingIdentity,
      encryptionKey,
      decryptionKey,
      credentials: extractLoginCredentials(request, dataResponseMap),
    }
  } catch (e) {
    return {
      identity: signingIdentity,
      encryptionKey,
      decryptionKey,
      credentialError: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * Finds the saved sign in for an account by any of its names, such as its
 * handle, email or the username it was saved with. Case and a leading @ don't
 * matter. When several match, the newest wins.
 */
export function findLoginCredentials(
  credentials: LoginCredentials[],
  accountNames: Array<string | undefined>,
): LoginCredentials | undefined {
  const names = new Set(
    accountNames
      .filter((name): name is string => !!name?.trim())
      .map(name => normalizeAccountName(name)),
  )

  return credentials.findLast(
    ({username, label}) =>
      names.has(normalizeAccountName(username)) ||
      (label != null && names.has(normalizeAccountName(label))),
  )
}

function normalizeAccountName(name: string) {
  return name.trim().toLowerCase().replace(/^@/, '')
}

/**
 * Gets every saved sign in from the response. Wallets send all the sign ins
 * saved for the Linked ID, oldest first. Saving again adds another one instead of
 * replacing the old one, so only the newest is kept for each username.
 */
function extractLoginCredentials(
  request: GenericRequest,
  dataResponseMap: Map<string, DataResponseOrdinalVDXFObject>,
): LoginCredentials[] {
  const userDataRequestID = request.details.find(
    (ordinal): ordinal is UserDataRequestOrdinalVDXFObject =>
      ordinal instanceof UserDataRequestOrdinalVDXFObject,
  )?.data.requestID

  if (!userDataRequestID) {
    throw new Error('Missing request ID for the user data in the request')
  }

  const userDataOrdinal = dataResponseMap.get(userDataRequestID.toIAddress())

  if (!userDataOrdinal) {
    throw new Error('Missing sign in credentials in VerusID response')
  }

  const dataDescriptor = userDataOrdinal.data.data
  const uniValue = new VdxfUniValue()
  uniValue.fromBuffer(dataDescriptor.objectdata)

  const credentials = uniValue.values
    .map(value => value[DATA_TYPE_OBJECT_CREDENTIAL.vdxfid])
    .filter((c): c is Credential => c instanceof Credential)

  if (credentials.length === 0) {
    throw new Error('Missing sign in credentials in VerusID response')
  }

  const plainLoginCredentials = credentials.filter(
    c => c.credentialKey === IDENTITY_CREDENTIAL_PLAINLOGIN.vdxfid,
  )

  const newestByUsername = new Map<string, LoginCredentials>()
  let firstError: Error | undefined

  for (const credential of plainLoginCredentials) {
    try {
      const login = readPlainLogin(credential)
      const key = normalizeAccountName(login.username)
      // Delete first, so that the newest one moves to the end.
      newestByUsername.delete(key)
      newestByUsername.set(key, login)
    } catch (e) {
      firstError ??= e instanceof Error ? e : new Error(String(e))
    }
  }

  if (newestByUsername.size === 0) {
    throw firstError ?? new Error('Invalid credentials')
  }

  return [...newestByUsername.values()]
}

// Reads a plain login credential, which holds [username, password].
function readPlainLogin(credential: Credential): LoginCredentials {
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
    label: credential.label || undefined,
  }
}
