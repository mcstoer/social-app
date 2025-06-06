import base64url from 'base64url'
import * as bodyParser from 'body-parser'
import * as express from 'express'
import {
  LOGIN_CONSENT_RESPONSE_VDXF_KEY,
  LoginConsentResponse,
} from 'verus-typescript-primitives'

import {generateLoginRequest, verifyLoginResponse} from './getLoginRequest'

const loginRouter = express.Router()

loginRouter.get('/get-login-request', async (req, res) => {
  try {
    const result = await generateLoginRequest()

    if (result.error) {
      console.error(result.error)
      res.status(500).json(result)
    } else {
      res.status(200).json(result)
    }
  } catch (error) {
    console.error('Error processing login request:', error)
    res.status(500).send('Internal Server Error')
  }
})

loginRouter.post('/confirm-login', bodyParser.json(), async (req, res) => {
  const valid = await verifyLoginResponse(req.body)
  if (valid) {
    const loginResponse = new LoginConsentResponse(req.body)
    // Need to call getidentity
    res.status(200).send('Login confirmed' + loginResponse.signing_id)
    console.log('Login confirmed')
  } else {
    console.log('Unable to verify response')
    res.status(500).json('Unable to verify response')
  }
})

loginRouter.get('/confirm-login', bodyParser.json(), async (req, res) => {
  if (req.query[LOGIN_CONSENT_RESPONSE_VDXF_KEY.vdxfid]) {
    const resp = req.query[LOGIN_CONSENT_RESPONSE_VDXF_KEY.vdxfid] as string
    const response = new LoginConsentResponse()
    response.fromBuffer(base64url.toBuffer(resp))
    const valid = await verifyLoginResponse(response)
    if (valid) {
      res.status(200).send('Login confirmed ' + response.signing_id)
      console.log('Login confirmed')
      return
    }
  }

  console.log('Unable to verify response')
  res.status(500).json('Unable to verify response')
})

export {loginRouter}
