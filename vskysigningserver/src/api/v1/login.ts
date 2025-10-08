import * as express from 'express'
import {
  LoginConsentChallenge,
  type LoginConsentRequest,
  LoginConsentResponse,
} from 'verus-typescript-primitives'

import {createSignedLoginRequest} from './getLoginRequest'

const loginRouter = express.Router()

// Needed to process the JSON in the login response.
loginRouter.use(express.json())

type LoginId = string

type Login = {
  request?: LoginConsentRequest
  response?: LoginConsentResponse
}

const logins = new Map<LoginId, Login>()

loginRouter.post('/sign-login-request', async (req, res) => {
  const challenge = new LoginConsentChallenge(req.body)
  const id = challenge.challenge_id
  console.log(
    `Signing login request with id ${id} at ${new Date().toLocaleTimeString()}`,
  )

  const signedReq = await createSignedLoginRequest(challenge)
  logins.set(id, {request: signedReq, response: undefined})
  res.status(200).json(signedReq.toJson())
})

loginRouter.post('/confirm-login', async (req, res) => {
  const response = new LoginConsentResponse(req.body)
  const id = response.decision.decision_id

  const login = logins.get(id)
  if (login) {
    console.log(
      `Received login response with id ${id} at ${new Date().toLocaleTimeString()}`,
    )
    login.response = response
    logins.set(id, login)
    res.status(200).send('Login response received.')
  } else {
    // Unknown IDs are ones that have no associated challenge we signed.
    console.log(
      `Received login response with unknown id ${id} at ${new Date().toLocaleTimeString()}`,
    )
    res.status(400).send('Unknown login response ID.')
  }
})

loginRouter.get('/get-login-response', async (req, res) => {
  const {requestId} = req.query
  const login = logins.get(requestId as string)
  if (login && login.response) {
    res.status(200).json(login.response.toJson())
  } else {
    res.status(204).send('No login received.')
  }
})

export {loginRouter}
