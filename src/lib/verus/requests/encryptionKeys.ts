import {
  type AppEncryptionRequestOrdinalVDXFObject,
  type AuthenticationRequestOrdinalVDXFObject,
  CompactIAddressObject,
  type GenericRequest,
  type GenericResponse,
  RecipientConstraint,
} from 'verus-typescript-primitives'

import {
  type AppEncryptionKeys,
  extractAppEncryptionKeys,
  generateAppEncryptionRequestOrdinal,
} from './details/appEncryptionDetail'
import {
  type AuthenticationRequestOptions,
  generateAuthenticationRequestOrdinal,
} from './details/authDetail'
import {buildDataResponseMap} from './genericResponse'

export interface EncryptionKeysRequestOptions {
  identityAddress: string
  auth?: AuthenticationRequestOptions
}

export type EncryptionKeysResponse = AppEncryptionKeys

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

  const authentication = generateAuthenticationRequestOrdinal({
    ...options.auth,
    recipientConstraints,
  })

  const {ordinal: appEncryptionOrdinal, ivk} =
    await generateAppEncryptionRequestOrdinal()

  return {
    ordinals: [authentication, appEncryptionOrdinal],
    ivk,
  }
}

export async function processEncryptionKeysResponse(
  request: GenericRequest,
  response: GenericResponse,
  ivk: Buffer,
): Promise<EncryptionKeysResponse> {
  const dataResponseMap = buildDataResponseMap(response)

  return extractAppEncryptionKeys({request, dataResponseMap, ivk})
}
