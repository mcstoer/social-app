import {
  type GenericRequest,
  type GenericResponse,
} from 'verus-typescript-primitives'

import {idInterface} from '#/config'
import {v2StoreInstance} from '#/api/v2/common/request-store'

export class ResponsesService {
  getResponse(requestId: string): GenericResponse | undefined {
    if (!v2StoreInstance.hasAttempt(requestId)) {
      return undefined
    }

    const attempt = v2StoreInstance.getAttempt(requestId)
    return attempt?.response as GenericResponse | undefined
  }

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

    const attempt = v2StoreInstance.getAttempt(id)

    if (!attempt) {
      console.log(
        `Received response with unknown id ${id} at ${new Date().toLocaleTimeString()}`,
      )
      return {success: false, status: 400, message: 'Unknown response ID.'}
    }

    const isValid = await this.verifyResponse(response)

    if (!isValid) {
      console.log(
        `Received invalid response with id ${id} at ${new Date().toLocaleTimeString()}`,
      )
      return {success: false, status: 400, message: 'Invalid response.'}
    }

    const originalRequest = attempt.request as GenericRequest

    console.log(
      `Received response with id ${id} at ${new Date().toLocaleTimeString()}`,
    )

    const originalHash = originalRequest.getRawDataSha256()
    if (!response.requestHash || !originalHash.equals(response.requestHash)) {
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
