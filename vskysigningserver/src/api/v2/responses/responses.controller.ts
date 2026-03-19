import base64url from 'base64url'
import {type Request, type Response} from 'express'
import {
  GENERIC_ENVELOPE_DEEPLINK_VDXF_KEY,
  GenericResponse,
} from 'verus-typescript-primitives'

import {responsesService} from './responses.service'

export class ResponsesController {
  async receiveWebhook(req: Request, res: Response): Promise<void> {
    try {
      const buffer: Buffer = req.body

      const genericResponse = new GenericResponse()
      genericResponse.fromBuffer(buffer)

      const result = await responsesService.processResponse(genericResponse)
      res.status(result.status).send(result.message)
    } catch (error) {
      console.error('Error processing webhook:', error)
      res.status(500).json({message: 'Internal server error'})
    }
  }

  async receiveRedirect(req: Request, res: Response): Promise<void> {
    try {
      const responseData = req.query[GENERIC_ENVELOPE_DEEPLINK_VDXF_KEY.vdxfid]

      if (!responseData || typeof responseData !== 'string') {
        res.status(400).send('Missing or invalid response parameter.')
        return
      }

      const genericResponse = new GenericResponse()
      genericResponse.fromBuffer(base64url.toBuffer(responseData))

      const result = await responsesService.processResponse(genericResponse)
      res.status(result.status).send(result.message)
    } catch (error) {
      console.error('Error processing redirect:', error)
      res.status(500).json({message: 'Internal server error'})
    }
  }
}

export const responsesController = new ResponsesController()
