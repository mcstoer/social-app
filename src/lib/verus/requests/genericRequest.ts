import BN from 'bn.js'
import {
  CompactIAddressObject,
  GenericRequest,
  type GenericRequestInterface,
  type OrdinalVDXFObject,
  ResponseURI,
} from 'verus-typescript-primitives'
import {type VerusIdInterface} from 'verusid-ts-client'

import {LOCAL_DEV_VSKY_SERVER} from '#/lib/constants'
import {generateRequestID} from '#/lib/verus/addresses'
import {DEFAULT_CHAIN, VERUSSKY_APP_ID} from '#/env'

const RESPONSES_ENDPOINT = `${LOCAL_DEV_VSKY_SERVER}/api/v2/responses`
const SIGNING_ENDPOINT = `${LOCAL_DEV_VSKY_SERVER}/api/v2/signing`

const responseURIs = [
  ResponseURI.fromUriString(RESPONSES_ENDPOINT, ResponseURI.TYPE_POST),
]

async function createGenericRequest(
  verusIdInterface: VerusIdInterface,
  ordinals: OrdinalVDXFObject[],
) {
  const isTestnet = DEFAULT_CHAIN === 'VRSCTEST'

  const params: GenericRequestInterface = {
    requestID: generateRequestID(),
    createdAt: new BN((Date.now() / 1000).toFixed(0)),
    responseURIs,
    details: ordinals,
    appOrDelegatedID: CompactIAddressObject.fromAddress(
      VERUSSKY_APP_ID,
      DEFAULT_CHAIN,
    ),
    flags: isTestnet
      ? GenericRequest.BASE_FLAGS.or(GenericRequest.FLAG_IS_TESTNET)
      : GenericRequest.BASE_FLAGS,
  }

  return await verusIdInterface.createGenericRequest(params)
}

async function signGenericRequest(
  request: GenericRequest,
): Promise<GenericRequest> {
  const response = await fetch(SIGNING_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(request.toBuffer()),
  })

  if (!response.ok) {
    throw new Error(`Signing request failed: ${response.status}`)
  }

  const buffer = Buffer.from(await response.arrayBuffer())
  const signed = new GenericRequest()
  signed.fromBuffer(buffer)
  return signed
}

export async function createAndSignGenericRequest(
  verusIdInterface: VerusIdInterface,
  ordinals: OrdinalVDXFObject[],
): Promise<GenericRequest> {
  const request = await createGenericRequest(verusIdInterface, ordinals)
  return await signGenericRequest(request)
}
