import {
  AppEncryptionRequestOrdinalVDXFObject,
  AppEncryptionResponseDetails,
  AuthenticationRequestOrdinalVDXFObject,
  CompactIAddressObject,
  DataResponseOrdinalVDXFObject,
  type GenericRequest,
  type GenericResponse,
  RecipientConstraint,
  SaplingPaymentAddress,
} from 'verus-typescript-primitives'

import {decryptDescriptor, zGetEncryptionAddress} from '../zsupport/crypto'
import {generateAppEncryptionRequestDetails} from './details/appEncryptionDetail'
import {
  type AuthenticationRequestOptions,
  generateAuthenticationRequestDetails,
} from './details/authDetail'

export interface EncryptionKeysRequestOptions {
  identityAddress: string
  auth?: AuthenticationRequestOptions
}

export interface EncryptionKeysResponse {
  encryptionKey: SaplingPaymentAddress
  decryptionKey: Buffer
}

export interface EncryptionKeysRequestOrdinals {
  ordinals: [
    AuthenticationRequestOrdinalVDXFObject,
    AppEncryptionRequestOrdinalVDXFObject,
  ]
  ivk: Buffer
}

export async function generateEncryptionKeysRequestOrdinals(
  options: EncryptionKeysRequestOptions,
): Promise<EncryptionKeysRequestOrdinals> {
  const recipientConstraints = [
    new RecipientConstraint({
      type: RecipientConstraint.REQUIRED_ID,
      identity: new CompactIAddressObject({
        type: CompactIAddressObject.TYPE_I_ADDRESS,
        address: options.identityAddress,
      }),
    }),
  ]

  const authentication = new AuthenticationRequestOrdinalVDXFObject({
    data: generateAuthenticationRequestDetails({
      ...options.auth,
      recipientConstraints,
    }),
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
    ordinals: [authentication, appEncryptionOrdinal],
    ivk: ivk,
  }
}

export async function processEncryptionKeysResponse(
  request: GenericRequest,
  response: GenericResponse,
  ivk: Buffer,
): Promise<EncryptionKeysResponse> {
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

  // Same process as in login.ts
  const decryptedDescriptor = await decryptDescriptor({
    descriptor: encryptedAppEncryptionOrdinal.data.data,
    ivk,
  })
  const appEncryptionDetail = new AppEncryptionResponseDetails()
  appEncryptionDetail.fromBuffer(decryptedDescriptor.objectdata)

  return {
    encryptionKey: appEncryptionDetail.address,
    decryptionKey: appEncryptionDetail.incomingViewingKey,
  }
}
