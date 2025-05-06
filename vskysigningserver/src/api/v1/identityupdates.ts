import base64url from 'base64url'
import * as bodyParser from 'body-parser'
import * as express from 'express'
import {
  IDENTITY_UPDATE_REQUEST_VDXF_KEY,
  IdentityUpdateRequest,
  IdentityUpdateRequestDetails,
} from 'verus-typescript-primitives'

import {
  generateIdentityUpdateRequest,
  verifyIdentityUpdateResponse,
} from './getIdentityUpdateRequest'

const identityUpdatesRouter = express.Router()

identityUpdatesRouter.post(
  '/update-credentials',
  bodyParser.json(),
  async (req, res) => {
    try {
      console.log(req.body)
      const details = IdentityUpdateRequestDetails.fromJson(req.body)
      console.log(details)
      console.log(typeof details.getByteLength === 'function')
      console.log(details.getByteLength)
      const result = await generateIdentityUpdateRequest(details)

      if (result.error) {
        console.error(result.error)
        res.status(500).json(result)
      } else {
        res.status(200).json(result)
      }
    } catch (error) {
      console.error('Error processing identity update request:', error)
      res.status(500).json({error: 'Internal Server Error'})
    }
  },
)

identityUpdatesRouter.get('/get-credential-update', async (req, res) => {
  try {
    const requestId = req.query.requestId as string
    if (!requestId) {
      res.status(400).json({error: 'Request ID is required'})
      return
    }

    // Return no content if no response yet
    res.status(204).send()
  } catch (error) {
    console.error('Error checking credential update status:', error)
    res.status(500).json({error: 'Internal Server Error'})
  }
})

identityUpdatesRouter.get('/confirm-update', async (req, res) => {
  if (req.query[IDENTITY_UPDATE_REQUEST_VDXF_KEY.vdxfid]) {
    const resp = req.query[IDENTITY_UPDATE_REQUEST_VDXF_KEY.vdxfid] as string
    const response = new IdentityUpdateRequest()
    response.fromBuffer(base64url.toBuffer(resp))
    const valid = await verifyIdentityUpdateResponse(response)
    if (valid) {
      res.status(200).json({success: true})
      console.log('Update confirmed')
      return
    }
  }

  console.log('Unable to verify update response')
  res.status(500).json({error: 'Unable to verify update response'})
})

export {identityUpdatesRouter}
