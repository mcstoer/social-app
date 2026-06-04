import BN from 'bn.js'
import {
  AppEncryptionRequestDetails,
  type CompactIAddressObject,
  type SaplingPaymentAddress,
} from 'verus-typescript-primitives'

import {generateRequestID} from '../../addresses'

export interface AppEncryptionRequestOptions {
  encryptResponseToAddress: SaplingPaymentAddress
  derivationNumber?: BN
  derivationID?: CompactIAddressObject
  requestID?: CompactIAddressObject
  returnESK?: boolean
}

export function generateAppEncryptionRequestDetails(
  options: AppEncryptionRequestOptions,
) {
  const flags = options.returnESK
    ? AppEncryptionRequestDetails.FLAG_RETURN_ESK
    : new BN(0)

  return new AppEncryptionRequestDetails({
    flags,
    encryptResponseToAddress: options.encryptResponseToAddress,
    derivationNumber: options.derivationNumber ?? new BN(0),
    derivationID: options.derivationID,
    requestID: options.requestID ?? generateRequestID(),
  })
}
