import * as express from 'express'

import {generateLoginRequest} from './getLoginRequest'

const loginRouter = express.Router()

// Needed to process the JSON in the login response.
loginRouter.use(express.json())

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

let lastLogin: any

loginRouter.post('/confirm-login', async req => {
  console.log('Received login response at', new Date().toLocaleTimeString())
  lastLogin = req.body
})

loginRouter.get('/get-login-response', async (_, res) => {
  if (!lastLogin) {
    res.status(204).send('No login received.')
  } else {
    res.status(200).json(lastLogin)
    // Clean up the last login after relaying it.
    lastLogin = null
  }
})

export {loginRouter}
