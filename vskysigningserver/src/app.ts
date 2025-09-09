import cors from 'cors'
import express from 'express'

import {v1Router} from './api/v1_route'

const app = express()

app.use(cors())

app.use('/api/v1', v1Router)

app.all('*', (req, res) => {
  res.status(404)
  res.send('VerusSky Signing Server')
})

export {app}
