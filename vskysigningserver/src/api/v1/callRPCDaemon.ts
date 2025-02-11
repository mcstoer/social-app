import axios from 'axios'

export interface error {
  code: number
  message: string
}

export interface rpcResult {
  result: object
  error: error | null
  id: string
}

// callRPCDaemon sends a post request to the json rpc server at `url`
// with the `command` and `parameters`
export const callRPCDaemon = async (
  url: string,
  username: string,
  password: string,
  command: string,
  parameters?: (string | object)[],
): Promise<rpcResult> => {
  // TODO: Figure out what to set the ids to.
  const id = '1'

  const body = {
    jsonrpc: '1.0',
    id: id,
    method: command,
    params: parameters ? parameters : [],
  }

  // Let the error be thrown to catch in the calling function.
  const res = await axios.post(url, body, {
    headers: {
      'Content-Type': 'text/plain',
    },
    auth: {
      username: username,
      password: password,
    },
  })

  return res.data
}
