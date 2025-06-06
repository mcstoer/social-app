import {Router} from 'express'

import {loginRouter} from './v1/login'
import {provisioningRouter} from './v1/provisioning'

const router = Router()

router.use('/login', loginRouter)
router.use('/provisioning', provisioningRouter)

export {router as v1Router}
