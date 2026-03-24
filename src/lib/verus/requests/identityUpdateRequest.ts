import {
  type GenericResponse,
  IdentityUpdateRequestOrdinalVDXFObject,
  IdentityUpdateResponseOrdinalVDXFObject,
  type OrdinalVDXFObject,
} from 'verus-typescript-primitives'

import {
  generateIdentityUpdateRequestDetails,
  type IdentityUpdateRequestOptions,
} from './details/identityUpdate'

export function generateIdentityUpdateRequestOrdinals(
  options: IdentityUpdateRequestOptions,
): [OrdinalVDXFObject] {
  const detail = generateIdentityUpdateRequestDetails(options)
  const identityUpdateOrdinal = new IdentityUpdateRequestOrdinalVDXFObject({
    data: detail,
  })
  return [identityUpdateOrdinal]
}

export function processIdentityUpdateResponse(
  response: GenericResponse,
): string | null {
  // The only ordinal in the response should be for the identity update.
  if (response.details.length <= 0) {
    throw new Error('Found no details in the response')
  }

  const ordinal = response.details[0]

  if (!(ordinal instanceof IdentityUpdateResponseOrdinalVDXFObject)) {
    throw new Error('Unexpected non-identity update ordinal in response')
  }

  const detail = ordinal.data

  if (detail.txid) {
    return detail.txid.toString('hex')
  }

  return null
}
