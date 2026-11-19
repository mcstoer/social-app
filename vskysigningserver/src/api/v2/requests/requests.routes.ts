import {raw, type RequestHandler, Router} from 'express'

import {MAX_ENVELOPE_BODY_SIZE} from '#/config'
import {requestsController} from './requests.controller'

const requestsRouter = Router()

requestsRouter.use(
  raw({
    type: 'application/octet-stream',
    limit: MAX_ENVELOPE_BODY_SIZE,
  }),
)

requestsRouter.post(
  '/',
  requestsController.registerRequest.bind(requestsController) as RequestHandler,
)

export {requestsRouter}
