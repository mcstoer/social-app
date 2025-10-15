import {useQuery} from '@tanstack/react-query'

import {VSKY_SERVICE} from '#/lib/constants'
import {VERUSSKY_CONFIG} from '#/env/verussky'
import {Agent} from '../session/agent'

const RQKEY_ROOT = 'service'
export const RQKEY = (serviceUrl: string) => [RQKEY_ROOT, serviceUrl]

export function useServiceQuery(serviceUrl: string) {
  return useQuery({
    queryKey: RQKEY(serviceUrl),
    queryFn: async () => {
      const agent = new Agent(null, {service: serviceUrl})
      // Use the config file server description for VerusSky.
      if (serviceUrl === VSKY_SERVICE) {
        return VERUSSKY_CONFIG.serverDescription
      }
      const res = await agent.com.atproto.server.describeServer()
      return res.data
    },
    enabled: isValidUrl(serviceUrl),
  })
}

function isValidUrl(url: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const urlp = new URL(url)
    return true
  } catch {
    return false
  }
}
