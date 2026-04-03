import * as express from 'express'
import {VerusPayInvoice} from 'verus-typescript-primitives'

import {signInvoice} from './signInvoice'

const invoicesRouter = express.Router()

invoicesRouter.use(express.json())

invoicesRouter.post('/sign', async (req, res) => {
  try {
    const invoice = VerusPayInvoice.fromJson(req.body)
    const signed = await signInvoice(invoice)
    res.status(200).json(signed.toJson())
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    console.error('Invoice signing error:', error.message)
    res.status(500).json({error: error.message})
  }
})

export {invoicesRouter}
