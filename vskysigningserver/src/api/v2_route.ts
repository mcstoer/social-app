import {Router} from 'express'

import {v2Routes} from './v2/routes'

const router = Router()

router.use('/', v2Routes)

export {router as v2Router}
