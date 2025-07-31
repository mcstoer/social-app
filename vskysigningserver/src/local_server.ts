// Load environment variables first, before any other imports
import './config'

import {app} from './app'
import {fetchWIF} from './utils/signing'

const PORT = process.env.PORT || 25000

async function startServer() {
  try {
    await fetchWIF(process.env.EXPO_PUBLIC_IADDRESS as string)
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Unable to fetch wif for signing:', (error as any).code)
    } else {
      console.error('Unable to fetch wif for signing:', error)
    }
    console.error('Please ensure that the Verus JSON RPC server is running.')
  }

  app.listen(PORT, () => {
    console.log(`VerusSky Signing Server running on port ${PORT}`)
  })
}

startServer()
