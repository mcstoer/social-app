import {GenericRequest} from 'verus-typescript-primitives'

import {v2StoreInstance} from '#/api/v2/common/request-store'
import {getRequestExpiry} from '#/api/v2/helpers/requestExpiry'
import {createSigData} from '#/api/v2/helpers/signData'
import {idInterface, REQUEST_TTL_SECONDS, signingAddress} from '#/config'
import {fetchWIF} from '#/services/signing'

export class SigningService {
  async signGenericRequest(buffer: Buffer): Promise<GenericRequest> {
    const request = new GenericRequest()
    request.fromBuffer(buffer)
    request.signature = createSigData()

    const wif = await fetchWIF(signingAddress)
    const signed = await idInterface.signGenericRequest(request, wif)

    if (!(await idInterface.verifyGenericRequest(signed))) {
      throw new Error('Invalid generic request after signing')
    }

    const requestID = signed.requestID
    if (requestID) {
      const storeKey = requestID.toAddress()
      v2StoreInstance.setRequest(
        storeKey,
        signed,
        getRequestExpiry(signed, REQUEST_TTL_SECONDS),
      )
    }

    return signed
  }
}

export const signingService = new SigningService()
