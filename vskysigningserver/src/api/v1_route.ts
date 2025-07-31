import {Router} from 'express'

import {identityUpdatesRouter} from './v1/identityupdates'
import {loginRouter} from './v1/login'
import {provisioningRouter} from './v1/provisioning'

const router = Router()

router.use('/login', loginRouter)
router.use('/provisioning', provisioningRouter)
router.use('/identityupdates', identityUpdatesRouter)

export {router as v1Router}
