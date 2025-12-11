import {useCallback, useMemo} from 'react'
import {useQuery, useQueryClient} from '@tanstack/react-query'

import {augmentSearchQuery} from '#/lib/strings/helpers'
import {
  checkIfLinkedVerusID,
  type VerusIdLink,
} from '#/lib/verus/accountLinking'
import {useVerusService} from '#/state/preferences'
import {STALE} from '#/state/queries'
import {useProfileQuery} from '#/state/queries/profile'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {useSearchPostsQuery} from '#/state/queries/search-posts'
import {useAgent} from '#/state/session'

export const createLinkedVerusIDQueryKey = (did: string) => [
  'verusid-linked',
  did,
]

export function useGetLinkedVerusID() {
  const queryClient = useQueryClient()
  const agent = useAgent()
  const {verusIdInterface} = useVerusService()

  return useCallback(
    async (linkIdentifier: string, did: string) => {
      const queryKey = createLinkedVerusIDQueryKey(did)

      return queryClient.fetchQuery({
        queryKey,
        staleTime: STALE.MINUTES.FIVE,
        queryFn: async () => {
          const profileRes = await agent.getProfile({actor: did})
          const handle = profileRes.data.handle

          if (!handle) {
            return null
          }

          const augmentedQuery = augmentSearchQuery(linkIdentifier, {
            did,
          })

          const searchRes = await agent.app.bsky.feed.searchPosts({
            q: augmentedQuery,
            limit: 25,
            sort: 'latest',
          })

          const posts = searchRes.data.posts ?? []

          return await checkIfLinkedVerusID(
            posts,
            linkIdentifier,
            verusIdInterface,
            handle,
          )
        },
      })
    },
    [agent, queryClient, verusIdInterface],
  )
}

export function useLinkedVerusIDQuery(
  linkIdentifier: string,
  name?: string,
  enabled?: boolean,
) {
  const {verusIdInterface} = useVerusService()
  const {data: resolvedDid} = useResolveDidQuery(name)

  const sort = 'latest'
  const query = linkIdentifier
  const augmentedQuery = useMemo(() => {
    return augmentSearchQuery(query || '', {did: resolvedDid})
  }, [query, resolvedDid])

  const {data: results} = useSearchPostsQuery({
    query: augmentedQuery,
    sort,
    enabled: (enabled ?? true) && !!resolvedDid,
  })

  const posts = useMemo(() => {
    return results?.pages.flatMap(page => page.posts) || []
  }, [results])

  const {data: profile} = useProfileQuery({did: resolvedDid})

  return useQuery({
    enabled: (enabled ?? true) && !!results && !!profile && !!resolvedDid,
    staleTime: STALE.MINUTES.FIVE,
    queryKey: createLinkedVerusIDQueryKey(resolvedDid || ''),
    queryFn: async (): Promise<VerusIdLink | null> => {
      return checkIfLinkedVerusID(
        posts,
        linkIdentifier,
        verusIdInterface,
        profile?.handle,
      )
    },
  })
}
