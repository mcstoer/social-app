import {
  IdentityUpdateRequestDetails,
  type IdentityUpdateRequestDetailsJson,
  IdentityUpdateRequestOrdinalVDXFObject,
  type OrdinalVDXFObject,
  type VerusCLIVerusIDJsonWithData,
} from 'verus-typescript-primitives'

import {generateRequestID} from '#/lib/verus/addresses'

export interface IdentityUpdateRequestOptions {
  identityJSON: VerusCLIVerusIDJsonWithData
  requestDetailsJSON?: IdentityUpdateRequestDetailsJson
}

export function generateIdentityUpdateRequestDetails(
  options: IdentityUpdateRequestOptions,
) {
  const requestID = generateRequestID()

  if (options.requestDetailsJSON) {
    options.requestDetailsJSON.requestid = requestID.toJson()
  } else {
    options.requestDetailsJSON = {
      requestid: requestID.toJson(),
    }
  }

  const updateDetails = IdentityUpdateRequestDetails.fromCLIJson(
    options.identityJSON,
    options.requestDetailsJSON,
  )

  return updateDetails
}

export function generateIdentityUpdateRequestOrdinal(
  options: IdentityUpdateRequestOptions,
): OrdinalVDXFObject {
  const detail = generateIdentityUpdateRequestDetails(options)
  const identityUpdateOrdinal = new IdentityUpdateRequestOrdinalVDXFObject({
    data: detail,
  })
  return identityUpdateOrdinal
}
