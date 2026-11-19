import {raw, type RequestHandler, Router} from 'express'

import {MAX_ENVELOPE_BODY_SIZE} from '#/config'
import {responsesController} from './responses.controller'

const router = Router()

const getRouter = Router()
getRouter.get(
  '/get',
  responsesController.getResponse.bind(responsesController) as RequestHandler,
)

const webhookRouter = Router()
webhookRouter.use(
  raw({
    type: 'application/octet-stream',
    limit: MAX_ENVELOPE_BODY_SIZE,
  }),
)
webhookRouter.post(
  '/',
  responsesController.receiveWebhook.bind(
    responsesController,
  ) as RequestHandler,
)

const redirectRouter = Router()
redirectRouter.get(
  '/',
  responsesController.receiveRedirect.bind(
    responsesController,
  ) as RequestHandler,
)

// Mount all routers
router.use('/', getRouter)
router.use('/', webhookRouter)
router.use('/', redirectRouter)

export {router as responsesRouter}
