import {Router} from 'express'

import {requestsRouter} from './requests/requests.routes'
import {responsesRouter} from './responses/responses.routes'
import {serviceInfoRouter} from './service-info/service-info.routes'
import {signingRouter} from './signing/signing.routes'

const router = Router()

router.use('/signing', signingRouter)
router.use('/requests', requestsRouter)
router.use('/responses', responsesRouter)
router.use('/service-info', serviceInfoRouter)

export {router as v2Routes}
