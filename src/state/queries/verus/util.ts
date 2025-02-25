import axios from 'axios'

import {logger} from '#/logger'
import {rpcResult} from './types'

export const callRPCDaemon = async (
  url: string,
  command: string,
  parameters?: (string | object)[],
): Promise<rpcResult> => {
  try {
    const res = await axios.post(`${url}/call-daemon`, {command, parameters})
    return res.data
  } catch (e) {
    logger.warn('Failed Verus Daemon RPC call', {error: e, command})
    throw e
  }
}
