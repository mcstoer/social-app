import cors from 'cors'
import express from 'express'

import {v1Router} from './api/v1_route'
import {v2Router} from './api/v2_route'

const app = express()

app.use(cors())

app.use('/api/v1', v1Router)
app.use('/api/v2', v2Router)

app.use((req, res) => {
  res.status(404)
  res.send('VerusSky Signing Server')
})

export {app}
