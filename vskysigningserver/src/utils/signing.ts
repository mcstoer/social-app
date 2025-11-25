import {verusDaemonConfig} from '../config'
import {callRPCDaemon} from './callRPCDaemon'

export const fetchWIF = async (iaddress: string): Promise<string> => {
  const identityResponse = await callRPCDaemon(
    verusDaemonConfig,
    'getidentity',
    [iaddress],
  )

  const primaryAdresses = (identityResponse.result as any).identity
    .primaryaddresses

  let privKeyResponse
  let lastErr = null
  for (const rAddress of primaryAdresses) {
    try {
      privKeyResponse = await callRPCDaemon(verusDaemonConfig, 'dumpprivkey', [
        rAddress,
      ])
      // Ignore errors for now and keep trying addresses in the case of multiple owners.
    } catch (error) {
      lastErr = error
    }
  }

  // Rethrow the last error if we never got a privKeyResponse.
  if (!privKeyResponse) {
    throw lastErr
  }

  return privKeyResponse.result as unknown as string
}
