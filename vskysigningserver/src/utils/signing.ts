import {callRPCDaemon} from './callRPCDaemon'

export const fetchWIF = async (iaddress: string): Promise<string> => {
  const rpcUrl = process.env.VERUS_RPC_SERVER!
  const username = process.env.VERUS_RPC_USERNAME!
  const password = process.env.VERUS_RPC_PASSWORD!

  const identityResponse = await callRPCDaemon(
    rpcUrl,
    username,
    password,
    'getidentity',
    [iaddress],
  )
  const rAddress = (identityResponse.result as any).identity.primaryaddresses[0]

  const privKeyResponse = await callRPCDaemon(
    rpcUrl,
    username,
    password,
    'dumpprivkey',
    [rAddress],
  )
  return privKeyResponse.result as unknown as string
}
