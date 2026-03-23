import {
  IdentityUpdateRequestOrdinalVDXFObject,
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
