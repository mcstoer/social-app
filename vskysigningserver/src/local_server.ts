// Load environment variables first, before any other imports
import './config'

import {app} from './app'
import {fetchWIF} from './utils/signing'

const PORT = process.env.PORT || 25000

async function startServer() {
  try {
    await fetchWIF(process.env.EXPO_PUBLIC_IADDRESS as string)
  } catch (error) {
    console.error('Unable to fetch wif for signing:', error)
    process.exit(1)
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

startServer()
