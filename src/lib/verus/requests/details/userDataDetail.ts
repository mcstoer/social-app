import type BN from 'bn.js'
import {
  type CompactIAddressObject,
  UserDataRequestDetails,
} from 'verus-typescript-primitives'

import {generateRequestID} from '../../addresses'

export interface UserDataRequestOptions {
  searchDataKey: Array<{[key: string]: string}>
  requestedKeys?: string[]
  signer?: CompactIAddressObject
  dataType: BN
  requestType: BN
}

export function generateUserDataRequestDetails(
  options: UserDataRequestOptions,
) {
  return new UserDataRequestDetails({
    flags: UserDataRequestDetails.FLAG_HAS_REQUEST_ID,
    requestID: generateRequestID(),
    searchDataKey: options.searchDataKey,
    requestedKeys: options.requestedKeys,
    signer: options.signer,
    dataType: options.dataType,
    requestType: options.requestType,
  })
}
