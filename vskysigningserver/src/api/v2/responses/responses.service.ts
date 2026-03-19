import {
  type GenericRequest,
  type GenericResponse,
} from 'verus-typescript-primitives'

import {idInterface} from '#/config'
import {v2StoreInstance} from '../common/request-store'

export class ResponsesService {
  async processResponse(
    response: GenericResponse,
  ): Promise<{success: boolean; status: number; message: string}> {
    const requestIDObj = response.requestID

    if (!requestIDObj) {
      console.log(
        `Received response with missing requestID at ${new Date().toLocaleTimeString()}`,
      )
      return {success: false, status: 400, message: 'Missing requestID.'}
    }

    const id = requestIDObj.toAddress()

    const isValid = await this.verifyResponse(response)

    if (!isValid) {
      console.log(
        `Received invalid response with id ${id} at ${new Date().toLocaleTimeString()}`,
      )
      return {success: false, status: 400, message: 'Invalid response.'}
    }

    if (!v2StoreInstance.hasAttempt(id)) {
      console.log(
        `Received response with unknown id ${id} at ${new Date().toLocaleTimeString()}`,
      )
      return {success: false, status: 400, message: 'Unknown response ID.'}
    }

    const attempt = v2StoreInstance.getAttempt(id)
    const originalRequest = attempt?.request as GenericRequest | undefined

    console.log('Response Contents:')
    console.log(JSON.stringify(response.toJson(), null, 2))

    console.log(
      `Received response with id ${id} at ${new Date().toLocaleTimeString()}`,
    )

    if (originalRequest?.getRawDataSha256 !== response?.requestHash) {
      console.log(`Request hash mismatch for response with id ${id}`)
      return {success: false, status: 400, message: 'Request hash mismatch.'}
    }

    v2StoreInstance.setResponse(id, response)
    return {success: true, status: 200, message: 'Response received.'}
  }

  async verifyResponse(response: GenericResponse): Promise<boolean> {
    return idInterface.verifyGenericResponse(response)
  }
}

export const responsesService = new ResponsesService()
