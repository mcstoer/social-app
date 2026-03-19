import {raw, type RequestHandler, Router} from 'express'

import {responsesController} from './responses.controller'

const router = Router()

const webhookRouter = Router()
webhookRouter.use(
  raw({
    type: 'application/octet-stream',
    limit: '10mb',
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

// Mount both routers
router.use('/', webhookRouter)
router.use('/', redirectRouter)

export {router as responsesRouter}
