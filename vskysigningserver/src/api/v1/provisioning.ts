import * as bodyParser from 'body-parser'
import * as dotenv from 'dotenv'
import * as express from 'express'
import {ProvisioningRequest} from 'verus-typescript-primitives/dist/vdxf/classes/provisioning/ProvisioningRequest'

import {
  checkProvisioningStatus,
  provisionIdentity,
  registerNameCommitment,
  signProvisioningResponse,
  transferIdentity,
} from './handleProvisioning'

dotenv.config()

const parent = process.env.PARENT === 'true'
const idtransfer = process.env.IDTRANSFER === 'true'

const provisioningRouter = express.Router()

provisioningRouter.get('/generate', bodyParser.json(), async (req, res) => {
  res.status(200).json('temp')
})

provisioningRouter.post('/', bodyParser.json(), async (req, res) => {
  const provisioningRequest = new ProvisioningRequest(req.body)

  if (idtransfer) {
    const {provisioningResponse} = await transferIdentity(provisioningRequest)
    const signedResponse = await signProvisioningResponse(provisioningResponse)
    res.json(signedResponse)
  } else {
    const {provisioningResponse, nameCommitment, decisionId} =
      await registerNameCommitment(provisioningRequest, parent)

    const signedResponse = await signProvisioningResponse(provisioningResponse)

    // Check to see if there was an error.
    if (nameCommitment === undefined || decisionId === undefined) {
      res.json(signedResponse)
    } else {
      res.json(signedResponse)
      await provisionIdentity(
        provisioningRequest,
        nameCommitment,
        parent,
        decisionId,
      )
    }
  }
})

provisioningRouter.get('/:decisionId', bodyParser.json(), async (req, res) => {
  const provisioningResponse = await checkProvisioningStatus(
    req.params.decisionId,
  )
  const signedResponse = await signProvisioningResponse(provisioningResponse)
  res.status(200).json(signedResponse)
})

export {provisioningRouter}
