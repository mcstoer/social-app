import {Router} from 'express'

import {identityUpdatesRouter} from './v1/identityupdates'
import {loginRouter} from './v1/login'
import {provisioningRouter} from './v1/provisioning'
import {serviceInfoRouter} from './v1/service-info'

const router = Router()

router.use('/login', loginRouter)
router.use('/provisioning', provisioningRouter)
router.use('/identityupdates', identityUpdatesRouter)
router.use('/service-info', serviceInfoRouter)

export {router as v1Router}
