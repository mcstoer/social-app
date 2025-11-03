import {useCallback, useMemo} from 'react'
import {useQuery, useQueryClient} from '@tanstack/react-query'
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
import {useAgent} from '#/state/session'

export const createLinkedVerusIDQueryKey = (did: string) => [
  'verusid-linked',
  did,
]

export function useGetLinkedVerusID() {
  const queryClient = useQueryClient()
  const agent = useAgent()

  return useCallback(
    async (
      linkIdentifier: string,
      did: string,
      verusIdInterface?: VerusIdInterface,
    ) => {
      const queryKey = createLinkedVerusIDQueryKey(did)

      return queryClient.fetchQuery({
        queryKey,
        staleTime: STALE.MINUTES.FIVE,
        queryFn: async () => {
          const profileRes = await agent.getProfile({actor: did})
          const handle = profileRes.data.handle

          if (!handle || !verusIdInterface) {
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
    [agent, queryClient],
  )
}

export function useLinkedVerusIDQuery(
  linkIdentifier: string,
  name?: string,
  verusIdInterface?: VerusIdInterface,
) {
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
    queryFn: async (): Promise<VerusIdLink | null> => {
      if (!verusIdInterface) {
        throw new Error('VerusIdInterface not provided')
      }

      return checkIfLinkedVerusID(
        posts,
        linkIdentifier,
        verusIdInterface,
        profile?.handle,
      )
    },
    staleTime: STALE.MINUTES.ONE,
  })
}
