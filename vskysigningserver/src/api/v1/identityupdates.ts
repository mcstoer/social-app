import * as express from 'express'
import {
  type IdentityUpdateEnvelopeJson,
  type IdentityUpdateRequest,
  IdentityUpdateRequestDetails,
  type IdentityUpdateRequestDetailsJson,
  IdentityUpdateResponse,
} from 'verus-typescript-primitives'

import {createSignedIdentityUpdateRequest} from './getIdentityUpdateRequest'

const identityUpdatesRouter = express.Router()

// Needed to process the JSON in the identity update response.
identityUpdatesRouter.use(express.json())

type IdentityUpdateId = string

type IdentityUpdate = {
  request?: IdentityUpdateRequest
  response?: IdentityUpdateResponse
}

const identityUpdates = new Map<IdentityUpdateId, IdentityUpdate>()

identityUpdatesRouter.post('/update-credentials', async (req, res) => {
  const detailsJson = req.body as IdentityUpdateRequestDetailsJson
  const id = detailsJson.requestid!
  console.log(
    `Signing identity update request with id ${id} at ${new Date().toLocaleTimeString()}`,
  )
  const details = IdentityUpdateRequestDetails.fromJson(req.body)

  const signedReq = await createSignedIdentityUpdateRequest(details)
  const signedReqJson = signedReq.toJson()
  identityUpdates.set(id, {request: signedReq, response: undefined})
  res.status(200).json(signedReqJson)
})

identityUpdatesRouter.post('/confirm-credential-update', async (req, res) => {
  const responseJson = req.body as IdentityUpdateEnvelopeJson
  const response = IdentityUpdateResponse.fromJson(responseJson)
  const id = responseJson.details.requestid!

  const identityUpdate = identityUpdates.get(id)
  if (identityUpdate) {
    console.log(
      `Received identity update response with id ${id} at ${new Date().toLocaleTimeString()}`,
    )
    identityUpdate.response = response
    identityUpdates.set(id, identityUpdate)
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
    const identityUpdate = identityUpdates.get(requestId as string)
    if (identityUpdate && identityUpdate.response) {
      res.status(200).json(identityUpdate.response.toJson())
    } else {
      res.status(204).send('No identity update response received.')
    }
  },
)

export {identityUpdatesRouter}
