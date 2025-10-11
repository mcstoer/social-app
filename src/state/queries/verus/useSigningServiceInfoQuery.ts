import {useQuery} from '@tanstack/react-query'

import {LOCAL_DEV_VSKY_SERVER} from '#/lib/constants'
import {STALE} from '#/state/queries'

export const createSigningAddressQueryKey = () => ['signing-address']

type SigningServiceInfo = {
  signingAddress: string
}

export function useSigningAddressQuery() {
  return useQuery({
    staleTime: STALE.MINUTES.THIRTY,
    queryKey: createSigningAddressQueryKey(),
    async queryFn() {
      const res = await fetch(`${LOCAL_DEV_VSKY_SERVER}/api/v1/service-info`)
      if (!res.ok) {
        throw new Error('Unable to fetch signing service information')
      }
      const data = (await res.json()) as SigningServiceInfo
      return data
    },
  })
}
