import {raw, type RequestHandler, Router} from 'express'

import {MAX_ENVELOPE_BODY_SIZE} from '#/config'
import {signingController} from './signing.controller'

const signingRouter = Router()

// TODO: Figure out if this is needed.
signingRouter.use(
  raw({
    type: 'application/octet-stream',
    limit: MAX_ENVELOPE_BODY_SIZE,
  }),
)

signingRouter.post(
  '/',
  signingController.signRequest.bind(signingController) as RequestHandler,
)

export {signingRouter}
