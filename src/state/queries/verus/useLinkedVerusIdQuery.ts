import {type AppBskyActorDefs} from '@atproto/api'
import {useQuery} from '@tanstack/react-query'
import {type VerusIdInterface} from 'verusid-ts-client'

import {checkIfLinkedVerusID} from '#/lib/verus/accountLinking'
import {STALE} from '#/state/queries'

const createLinkedVerusIDQueryKey = (did: string) => ['verusid-linked', did]

export function useLinkedVerusIDQuery(
  profile: AppBskyActorDefs.ProfileViewDetailed,
  verusIdInterface: VerusIdInterface | undefined,
) {
  return useQuery({
    queryKey: createLinkedVerusIDQueryKey(profile.did),
    queryFn: async () => {
      if (!verusIdInterface) {
        return {isLinked: false}
      }
      return checkIfLinkedVerusID(profile, verusIdInterface)
    },
    staleTime: STALE.MINUTES.FIVE,
  })
}
