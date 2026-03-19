import axios from 'axios'

import {verusDaemonConfig} from '../config'
import {type VerusDaemonConfig} from './daemonCredentials'

export interface error {
  code: number
  message: string
}

export interface rpcResult {
  result: object | string
  error: error | null
  id: string
}

// callRPCDaemon sends a post request to the json rpc server at `url`
// with the `command` and `parameters`
export const callRPCDaemon = async (
  verusDaemonConfig: VerusDaemonConfig,
  command: string,
  parameters?: (string | object)[],
): Promise<rpcResult> => {
  const url =
    'http://' + verusDaemonConfig.rpchost + ':' + verusDaemonConfig.rpcport
  const username = verusDaemonConfig.rpcuser
  const password = verusDaemonConfig.rpcpassword

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

// Shortcut for calling callRPCDaemon with the verus daemon config.
export const callDaemon = async (
  command: string,
  parameters?: (string | object)[],
): Promise<rpcResult> => {
  return await callRPCDaemon(verusDaemonConfig, command, parameters)
}
