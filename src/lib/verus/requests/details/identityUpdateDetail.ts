import {
  IdentityUpdateRequestDetails,
  type IdentityUpdateRequestDetailsJson,
  type VerusCLIVerusIDJsonWithData,
} from 'verus-typescript-primitives'

import {generateRequestID} from '../../addresses'

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
