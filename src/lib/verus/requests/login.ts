import {
  AppEncryptionRequestOrdinalVDXFObject,
  AppEncryptionResponseDetails,
  AuthenticationRequestOrdinalVDXFObject,
  AuthenticationResponseOrdinalVDXFObject,
  Credential,
  DATA_TYPE_OBJECT_CREDENTIAL,
  DataResponseOrdinalVDXFObject,
  type GenericRequest,
  type GenericResponse,
  IDENTITY_CREDENTIAL_PLAINLOGIN,
  type IdentityDefinition,
  SaplingPaymentAddress,
  UserDataRequestDetails,
  UserDataRequestOrdinalVDXFObject,
  VdxfUniValue,
} from 'verus-typescript-primitives'

import {type VerusGetIdentityQueryResult} from '#/state/queries/verus/useVerusGetIdentityQuery'
import {decryptDescriptor, zGetEncryptionAddress} from '../zsupport/crypto'
import {generateAppEncryptionRequestDetails} from './details/appEncryptionDetail'
import {
  type AuthenticationRequestOptions,
  generateAuthenticationRequestDetails,
} from './details/authDetail'
import {
  generateUserDataRequestDetails,
  type UserDataRequestOptions,
} from './details/userDataDetail'

export interface LoginRequestOptions {
  auth?: AuthenticationRequestOptions
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface LoginResponse {
  identity: IdentityDefinition
  credentials?: LoginCredentials
  credentialError?: string
  zaddress?: string
  ivk?: string
}

export interface LoginRequestOrdinals {
  ordinals: [
    AuthenticationRequestOrdinalVDXFObject,
    UserDataRequestOrdinalVDXFObject,
    AppEncryptionRequestOrdinalVDXFObject,
  ]
  ivk: Buffer
}

export async function generateLoginRequestOrdinals(
  options?: LoginRequestOptions,
): Promise<LoginRequestOrdinals> {
  const authentication = new AuthenticationRequestOrdinalVDXFObject({
    data: generateAuthenticationRequestDetails(options?.auth),
  })

  const loginCredentials: UserDataRequestOptions = {
    searchDataKey: [
      {[IDENTITY_CREDENTIAL_PLAINLOGIN.vdxfid]: 'Login Credentials'},
    ],
    dataType: UserDataRequestDetails.FULL_DATA,
    requestType: UserDataRequestDetails.CREDENTIAL,
  }

  const credentialOrdinal = new UserDataRequestOrdinalVDXFObject({
    data: generateUserDataRequestDetails(loginCredentials),
  })

  const seed = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
  const channelKeys = await zGetEncryptionAddress({
    seed: seed,
  })

  const zaddress = Buffer.from(channelKeys.address)
  const ivk = Buffer.from(channelKeys.ivk)

  const encryptResponseToAddress = new SaplingPaymentAddress()
  encryptResponseToAddress.fromBuffer(zaddress)

  const appEncryptionOrdinal = new AppEncryptionRequestOrdinalVDXFObject({
    data: generateAppEncryptionRequestDetails({
      encryptResponseToAddress,
    }),
  })

  return {
    ordinals: [authentication, credentialOrdinal, appEncryptionOrdinal],
    ivk: ivk,
  }
}

export async function processLoginResponse(
  request: GenericRequest,
  response: GenericResponse,
  getIdentity: (identity: string) => Promise<VerusGetIdentityQueryResult>,
  ivk: Buffer,
): Promise<LoginResponse> {
  // Just having the auth detail exist is enough for the response to be for signing in.
  const authOrdinal = response.details.find(
    (ordinal): ordinal is AuthenticationResponseOrdinalVDXFObject =>
      ordinal instanceof AuthenticationResponseOrdinalVDXFObject,
  )

  if (!authOrdinal) {
    throw new Error('Found no authentication response in the login response')
  }

  // Process the response and details to allow for simple data to the UI.
  const signature = response.signature

  if (!signature) {
    throw new Error('Missing signature in VerusID response')
  }

  const signingAddress = signature.identityID.toIAddress()

  const getIdentityResult = await getIdentity(signingAddress)
  const signingIdentity = getIdentityResult.identity

  // Prepare the data response details in a map for quick lookup against the
  // request IDs in the request.
  const dataResponseMap = new Map<string, DataResponseOrdinalVDXFObject>()

  for (const ordinal of response.details) {
    if (
      ordinal instanceof DataResponseOrdinalVDXFObject &&
      ordinal.data.requestID
    ) {
      dataResponseMap.set(ordinal.data.requestID.toIAddress(), ordinal)
    }
  }

  const appEncryptionRequestID = request.details.find(
    (ordinal): ordinal is AppEncryptionRequestOrdinalVDXFObject =>
      ordinal instanceof AppEncryptionRequestOrdinalVDXFObject,
  )?.data.requestID

  // If getting the keys fails, then the whole login should fail.
  if (!appEncryptionRequestID) {
    throw new Error('Missing request ID for the app encryption in the request')
  }

  const encryptedAppEncryptionOrdinal = dataResponseMap.get(
    appEncryptionRequestID.toIAddress(),
  )

  if (!encryptedAppEncryptionOrdinal) {
    throw new Error(
      'Missing encrypted app encryption ordinal in VerusID response',
    )
  }

  // decryptDescriptor unwraps the CVDXF_Data envelope that the daemon's
  // signdata adds before encrypting, returning the CDataDescriptor wrapper.
  // We actually want the contents of that descriptor, so we then
  // extract the objectdata to get the hex buffer of the detail.
  const decryptedDescriptor = await decryptDescriptor({
    descriptor: encryptedAppEncryptionOrdinal.data.data,
    ivk,
  })
  const appEncryptionDetail = new AppEncryptionResponseDetails()
  appEncryptionDetail.fromBuffer(decryptedDescriptor.objectdata)

  // Allow for VerusID login with invalid credentials so that the user can easily update
  // their stored credentials after a manual login.
  try {
    return {
      identity: signingIdentity,
      credentials: extractLoginCredentials(request, dataResponseMap),
      zaddress: appEncryptionDetail.address.toAddressString(),
      ivk: appEncryptionDetail.incomingViewingKey.toString('hex'),
    }
  } catch (e) {
    return {
      identity: signingIdentity,
      credentialError: e instanceof Error ? e.message : String(e),
    }
  }
}

function extractLoginCredentials(
  request: GenericRequest,
  dataResponseMap: Map<string, DataResponseOrdinalVDXFObject>,
): LoginCredentials {
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

  const plainLoginCredential = credentials.find(
    c => c.credentialKey === IDENTITY_CREDENTIAL_PLAINLOGIN.vdxfid,
  )

  if (!plainLoginCredential) {
    throw new Error('Missing plain login credential in VerusID response')
  }

  const plainLogin = plainLoginCredential?.credential

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
