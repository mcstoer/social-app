import {type Request, type Response} from 'express'

import {signingService} from './signing.service'

export class SigningController {
  async signRequest(req: Request, res: Response): Promise<void> {
    try {
      const buffer: Buffer = req.body

      const uri = await signingService.signGenericRequest(buffer)
      res.status(200).json({uri})
    } catch (error) {
      console.error('Error signing request:', error)
      res.status(500).json({message: 'Internal server error'})
    }
  }
}

export const signingController = new SigningController()
