import BN from 'bn.js'
import {
  AuthenticationRequestDetails,
  type RecipientConstraint,
} from 'verus-typescript-primitives'

import {generateRequestID} from '../../addresses'

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
