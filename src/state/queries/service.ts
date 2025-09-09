import {useQuery} from '@tanstack/react-query'

import {BSKY_SERVICE, VSKY_SERVICE} from '#/lib/constants'
import {Agent} from '../session/agent'

const RQKEY_ROOT = 'service'
export const RQKEY = (serviceUrl: string) => [RQKEY_ROOT, serviceUrl]

export function useServiceQuery(serviceUrl: string) {
  let url = serviceUrl

  // Redirect the VerusSky service to the Bluesky service that is uses.
  if (serviceUrl === VSKY_SERVICE) {
    url = BSKY_SERVICE
  }

  return useQuery({
    queryKey: RQKEY(serviceUrl),
    queryFn: async () => {
      const agent = new Agent(null, {service: url})
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
