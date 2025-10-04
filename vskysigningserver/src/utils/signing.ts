import {verusDaemonConfig} from '../config'
import {callRPCDaemon} from './callRPCDaemon'

export const fetchWIF = async (iaddress: string): Promise<string> => {
  const identityResponse = await callRPCDaemon(
    verusDaemonConfig,
    'getidentity',
    [iaddress],
  )
  const rAddress = (identityResponse.result as any).identity.primaryaddresses[0]

  const privKeyResponse = await callRPCDaemon(
    verusDaemonConfig,
    'dumpprivkey',
    [rAddress],
  )
  return privKeyResponse.result as unknown as string
}
