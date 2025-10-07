import * as bodyParser from 'body-parser'
import * as express from 'express'
import {
  type IdentityUpdateEnvelopeJson,
  IdentityUpdateRequestDetails,
} from 'verus-typescript-primitives'

import {generateIdentityUpdateRequest} from './getIdentityUpdateRequest'

const identityUpdatesRouter = express.Router()

// Needed to process the JSON in the identity update response.
identityUpdatesRouter.use(express.json())

identityUpdatesRouter.post(
  '/update-credentials',
  bodyParser.json(),
  async (req, res) => {
    try {
      const details = IdentityUpdateRequestDetails.fromJson(req.body)
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

let lastCredentialUpdate: IdentityUpdateEnvelopeJson | null

// New endpoint to store credential update response
identityUpdatesRouter.post('/confirm-credential-update', async req => {
  lastCredentialUpdate = req.body
})

// New endpoint to retrieve credential update response
identityUpdatesRouter.get(
  '/get-credential-update-response',
  async (req, res) => {
    const {requestId} = req.query

    const lastRequestId = lastCredentialUpdate?.details?.requestid

    if (
      !lastCredentialUpdate ||
      !lastRequestId ||
      lastRequestId !== requestId
    ) {
      res.status(204).send('No credential update response received.')
    } else {
      res.status(200).json(lastCredentialUpdate)
      // Clean up after relaying
      lastCredentialUpdate = null
    }
  },
)

export {identityUpdatesRouter}
