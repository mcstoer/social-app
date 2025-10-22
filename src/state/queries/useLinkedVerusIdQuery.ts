import {type AppBskyActorDefs} from '@atproto/api'
import {useQuery} from '@tanstack/react-query'
import {type VerusIdInterface} from 'verusid-ts-client'

import {checkIfLinkedVerusID} from '#/lib/verus/accountLinking'

export function useLinkedVerusIDQuery(
  profile: AppBskyActorDefs.ProfileViewDetailed,
  verusIdInterface: VerusIdInterface | undefined,
) {
  return useQuery({
    queryKey: ['verus-linked-id', profile.did],
    queryFn: async () => {
      if (!verusIdInterface) {
        return {isLinked: false}
      }
      return checkIfLinkedVerusID(profile, verusIdInterface)
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  })
}
