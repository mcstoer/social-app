import {type Response, Router} from 'express'

import {signingAddress} from '../../config'

const router = Router()

// Currently only returns the signing address used.
router.get('/', (_, res: Response) => {
  res.status(200).json({signingAddress})
})

export {router as serviceInfoRouter}
