import BN from 'bn.js'
import {
  AppEncryptionRequestDetails,
  AppEncryptionRequestOrdinalVDXFObject,
  AppEncryptionResponseDetails,
  type CompactIAddressObject,
  type DataResponseOrdinalVDXFObject,
  type GenericRequest,
  SaplingPaymentAddress,
} from 'verus-typescript-primitives'

import {generateRequestID} from '../../addresses'
import {decryptDescriptor, zGetEncryptionAddress} from '../../zsupport/crypto'

export interface AppEncryptionKeys {
  encryptionKey: SaplingPaymentAddress
  decryptionKey: Buffer
}

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

export interface AppEncryptionRequest {
  ordinal: AppEncryptionRequestOrdinalVDXFObject
  ivk: Buffer
}

export async function generateAppEncryptionRequestOrdinal(): Promise<AppEncryptionRequest> {
  const seed = Buffer.from(crypto.getRandomValues(new Uint8Array(32)))
  const channelKeys = await zGetEncryptionAddress({
    seed: seed,
  })

  const zaddress = Buffer.from(channelKeys.address)
  const ivk = Buffer.from(channelKeys.ivk)

  const encryptResponseToAddress = new SaplingPaymentAddress()
  encryptResponseToAddress.fromBuffer(zaddress)

  const ordinal = new AppEncryptionRequestOrdinalVDXFObject({
    data: generateAppEncryptionRequestDetails({
      encryptResponseToAddress,
    }),
  })

  return {ordinal, ivk}
}

// Finds and decrypts the AppEncryptionDetail from the DataResponseDetails.
export async function extractAppEncryptionKeys({
  request,
  dataResponseMap,
  ivk,
}: {
  request: GenericRequest
  dataResponseMap: Map<string, DataResponseOrdinalVDXFObject>
  ivk: Buffer
}): Promise<AppEncryptionKeys> {
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

  // decryptDescriptor unwraps the CVDXF_Data envelope that the daemon's
  // signdata adds before encrypting, returning the CDataDescriptor wrapper.
  // We actually want the contents of that descriptor, so we then
  // extract the objectdata to get the hex buffer of the detail.
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
