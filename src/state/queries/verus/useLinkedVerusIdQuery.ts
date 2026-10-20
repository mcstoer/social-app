import {useCallback, useMemo} from 'react'
import {type DidString} from '@atproto/syntax'
import {useQuery, useQueryClient} from '@tanstack/react-query'

import {
  checkIfLinkedVerusID,
  type VerusIdLink,
} from '#/lib/verus/accountLinking'
import {useVerusService} from '#/state/preferences'
import {GCTIME, STALE} from '#/state/queries'
import {useProfileQuery} from '#/state/queries/profile'
import {useResolveDidQuery} from '#/state/queries/resolve-uri'
import {useSearchPostsV2Query} from '#/state/queries/search-posts-v2'
import {createQueryKey} from '#/state/queries/util'
import {useAppviewClient} from '#/state/session'
import {app} from '#/lexicons'

export const createLinkedVerusIDQueryKey = (did: string) =>
  createQueryKey('verusid-linked', {did}, {persistedVersion: 1})

export function useGetLinkedVerusID() {
  const queryClient = useQueryClient()
  const client = useAppviewClient()
  const {verusIdInterface} = useVerusService()

  return useCallback(
    async (linkIdentifier: string, did: DidString) => {
      const queryKey = createLinkedVerusIDQueryKey(did)

      return queryClient.fetchQuery({
        queryKey,
        staleTime: STALE.MINUTES.FIVE,
        gcTime: GCTIME.INFINITY,
        queryFn: async () => {
          const profile = await client.call(app.bsky.actor.getProfile, {
            actor: did,
          })
          const handle = profile.handle

          if (!handle) {
            return null
          }

          const searchRes = await client.call(app.bsky.feed.searchPostsV2, {
            query: linkIdentifier,
            authors: [did],
            limit: 25,
            sort: 'recent',
            allTime: true,
          })

          const posts = searchRes.posts

          return await checkIfLinkedVerusID(
            posts,
            linkIdentifier,
            verusIdInterface,
            handle,
          )
        },
      })
    },
    [client, queryClient, verusIdInterface],
  )
}

export function useLinkedVerusIDQuery(
  linkIdentifier: string,
  name?: string,
  enabled?: boolean,
) {
  const {verusIdInterface} = useVerusService()
  const {data: resolvedDid} = useResolveDidQuery(name)

  const {data: results} = useSearchPostsV2Query({
    query: linkIdentifier,
    sort: 'latest',
    filters: {author: resolvedDid},
    enabled: (enabled ?? true) && !!resolvedDid,
  })

  const posts = useMemo(() => {
    return results?.pages.flatMap(page => page.posts) || []
  }, [results])

  const {data: profile} = useProfileQuery({
    did: resolvedDid,
  })

  const isEnabled = (enabled ?? true) && !!results && !!profile && !!resolvedDid

  const linkedVerusIDQuery = useQuery({
    enabled: isEnabled,
    staleTime: STALE.MINUTES.FIVE,
    gcTime: GCTIME.INFINITY,
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

  return {...linkedVerusIDQuery, isDisabled: !isEnabled}
}
