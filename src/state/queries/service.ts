import {BskyAgent} from '@atproto/api'
import {useQuery} from '@tanstack/react-query'

import {BSKY_SERVICE, VSKY_SERVICE} from '#/lib/constants'

const RQKEY_ROOT = 'service'
export const RQKEY = (serviceUrl: string) => [RQKEY_ROOT, serviceUrl]

export function useServiceQuery(serviceUrl: string) {
  let url = serviceUrl

  // Redirect the VeruSky service to the Bluesky service that is uses.
  if (serviceUrl === VSKY_SERVICE) {
    url = BSKY_SERVICE
  }

  return useQuery({
    queryKey: RQKEY(serviceUrl),
    queryFn: async () => {
      const agent = new BskyAgent({service: url})
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
