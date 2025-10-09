import * as express from 'express'
import {
  type IdentityUpdateEnvelopeJson,
  type IdentityUpdateRequest,
  IdentityUpdateRequestDetails,
  type IdentityUpdateRequestDetailsJson,
  IdentityUpdateResponse,
} from 'verus-typescript-primitives'

import {RequestResponseStore} from '../../utils/RequestResponseStore'
import {createSignedIdentityUpdateRequest} from './getIdentityUpdateRequest'

const identityUpdatesRouter = express.Router()

// Needed to process the JSON in the identity update response.
identityUpdatesRouter.use(express.json())

const identityUpdates = new RequestResponseStore<
  string,
  IdentityUpdateRequest,
  IdentityUpdateResponse
>()

identityUpdatesRouter.post('/update-credentials', async (req, res) => {
  const detailsJson = req.body as IdentityUpdateRequestDetailsJson
  const id = detailsJson.requestid!
  console.log(
    `Signing identity update request with id ${id} at ${new Date().toLocaleTimeString()}`,
  )
  const details = IdentityUpdateRequestDetails.fromJson(req.body)

  const signedReq = await createSignedIdentityUpdateRequest(details)
  const signedReqJson = signedReq.toJson()
  identityUpdates.setRequest(id, signedReq)
  res.status(200).json(signedReqJson)
})

identityUpdatesRouter.post('/confirm-credential-update', async (req, res) => {
  const responseJson = req.body as IdentityUpdateEnvelopeJson
  const response = IdentityUpdateResponse.fromJson(responseJson)
  const id = responseJson.details.requestid!

  if (identityUpdates.hasAttempt(id)) {
    console.log(
      `Received identity update response with id ${id} at ${new Date().toLocaleTimeString()}`,
    )
    identityUpdates.setResponse(id, response)
    res.status(200).send('Login response received.')
  } else {
    console.log(
      `Received identity update with unknown id ${id} at ${new Date().toLocaleTimeString()}`,
    )
    res.status(400).send('Unknown identity update ID.')
  }
})

identityUpdatesRouter.get(
  '/get-credential-update-response',
  async (req, res) => {
    const {requestId} = req.query
    const identityUpdate = identityUpdates.getAttempt(requestId as string)
    if (identityUpdate && identityUpdate.response) {
      res.status(200).json(identityUpdate.response.toJson())
    } else {
      res.status(204).send('No valid identity update response received.')
    }
  },
)

export {identityUpdatesRouter}
