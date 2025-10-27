import {useMemo} from 'react'
import {useQuery} from '@tanstack/react-query'
import {type VerusIdInterface} from 'verusid-ts-client'

import {augmentSearchQuery} from '#/lib/strings/helpers'
import {
  checkIfLinkedVerusID,
  type VerusIdLink,
} from '#/lib/verus/accountLinking'
import {STALE} from '#/state/queries'
import {useProfileQuery} from '#/state/queries/profile'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {useSearchPostsQuery} from '#/state/queries/search-posts'

const createLinkedVerusIDQueryKey = (did: string) => ['verusid-linked', did]

export function useLinkedVerusIDQuery(
  linkIdentifier: string,
  name?: string,
  verusIdInterface?: VerusIdInterface,
) {
  // Possibly should resolve the did and take a name (did or handle).
  const {data: resolvedDid} = useResolveDidQuery(name)

  const sort = 'latest'
  const query = linkIdentifier
  const augmentedQuery = useMemo(() => {
    return augmentSearchQuery(query || '', {did: resolvedDid})
  }, [query, resolvedDid])

  const {data: results} = useSearchPostsQuery({query: augmentedQuery, sort})

  const posts = useMemo(() => {
    return results?.pages.flatMap(page => page.posts) || []
  }, [results])

  const {data: profile} = useProfileQuery({did: resolvedDid})

  return useQuery({
    enabled: !!results && !!profile && !!resolvedDid,
    queryKey: createLinkedVerusIDQueryKey(resolvedDid || ''),
    queryFn: async (): Promise<VerusIdLink | undefined> => {
      if (!verusIdInterface) {
        return undefined
      }
      return checkIfLinkedVerusID(
        posts,
        linkIdentifier,
        verusIdInterface,
        profile?.handle,
      )
    },
    staleTime: STALE.MINUTES.FIVE,
  })
}
