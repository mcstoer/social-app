import {raw, type RequestHandler, Router} from 'express'

import {signingController} from './signing.controller'

const signingRouter = Router()

// TODO: Figure out if this is needed.
signingRouter.use(
  raw({
    type: 'application/octet-stream',
    limit: '10mb',
  }),
)

signingRouter.post(
  '/',
  signingController.signRequest.bind(signingController) as RequestHandler,
)

export {signingRouter}
