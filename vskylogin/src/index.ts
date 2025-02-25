import cors from 'cors'
import * as dotenv from 'dotenv'
import express from 'express'

import {callRPCDaemon} from './callRPCDaemon'

const app = express()
app.use(express.json())
app.use(cors())

dotenv.config()

const port = process.env.PORT || 21001

let lastLogin: any

app.post('/confirm-login', async req => {
  lastLogin = req.body
  console.log(lastLogin)
})

app.get('/get-login', async (_, res) => {
  console.log(lastLogin)
  if (!lastLogin) {
    res.status(204).send('No login received.')
  } else {
    res.status(200).json(lastLogin)
    // Clean up the last login after relaying it.
    lastLogin = null
  }
})

// Act as middleware between the app and the daemon to allow for CORS.
app.post('/call-daemon', async (req, res) => {
  const {command, parameters} = req.body
  const url = process.env.JSON_RPC_SERVER
  const username = process.env.RPC_USERNAME
  const password = process.env.RPC_PASSWORD

  try {
    const response = await callRPCDaemon(
      url,
      username,
      password,
      command,
      parameters,
    )
    res.status(response.status).json(response.data)
  } catch (e) {
    if (e.response) {
      res.status(e.response.status).json(e.response.data)
    } else {
      console.error('RPC Proxy Error:', e)
      res.status(500).json({
        error: 'Failed to proxy RPC request',
        message: e.message,
      })
    }
  }
})

app.listen(port, () => {
  console.log(`Server running on port ${port}`)
})
