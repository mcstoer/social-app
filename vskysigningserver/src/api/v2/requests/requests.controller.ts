import {type Request, type Response} from 'express'

import {v2StoreInstance} from '#/api/v2/common/request-store'
import {
  idInterface,
  REQUEST_TTL_SECONDS,
  signingAddress,
  SYSTEM_ID,
} from '#/config'
import {RequestsService} from './requests.service'

// This server signs as the app, so its signing ID is the app's ID.
const requestsService = new RequestsService({
  store: v2StoreInstance,
  appID: signingAddress,
  systemID: SYSTEM_ID,
  maxAgeSeconds: REQUEST_TTL_SECONDS,
  verifySignature: request => idInterface.verifyGenericRequest(request),
})

export class RequestsController {
  async registerRequest(req: Request, res: Response): Promise<void> {
    try {
      const result = await requestsService.registerRequest(req.body)
      res.status(result.status).send(result.message)
    } catch (error) {
      console.error('Error registering request:', error)
      res.status(500).json({message: 'Internal server error'})
    }
  }
}

export const requestsController = new RequestsController()
