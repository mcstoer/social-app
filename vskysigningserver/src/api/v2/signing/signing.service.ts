import {GenericRequest} from 'verus-typescript-primitives'

import {idInterface, signingAddress} from '#/config'
import {fetchWIF} from '#/services/signing'
import {v2StoreInstance} from '../common/request-store'
import {createSigData} from '../helpers/signData'

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
      v2StoreInstance.setRequest(storeKey, signed)
    }

    return signed
  }
}

export const signingService = new SigningService()
