import BN from 'bn.js'
import {
  AuthenticationRequestDetails,
  AuthenticationRequestOrdinalVDXFObject,
  type RecipientConstraint,
} from 'verus-typescript-primitives'

import {generateRequestID} from '#/lib/verus/addresses'

const DEFAULT_EXPIRY_SECONDS = 3600

export interface AuthenticationRequestOptions {
  expirySeconds?: number
  recipientConstraints?: RecipientConstraint[]
}

export function generateAuthenticationRequestDetails(
  options: AuthenticationRequestOptions = {},
) {
  const expirySeconds = options.expirySeconds ?? DEFAULT_EXPIRY_SECONDS

  return new AuthenticationRequestDetails({
    requestID: generateRequestID(),
    recipientConstraints: options.recipientConstraints,
    expiryTime: new BN(Math.floor(Date.now() / 1000) + expirySeconds),
  })
}

export function generateAuthenticationRequestOrdinal(
  options: AuthenticationRequestOptions = {},
) {
  return new AuthenticationRequestOrdinalVDXFObject({
    data: generateAuthenticationRequestDetails(options),
  })
}
