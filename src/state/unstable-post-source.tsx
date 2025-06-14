import {createContext, useCallback, useContext, useRef, useState} from 'react'
import {type AppBskyFeedDefs} from '@atproto/api'

import {type FeedDescriptor} from './queries/post-feed'

/**
 * For passing the source of the post (i.e. the original post, from the feed) to the threadview,
 * without using query params. Deliberately unstable to avoid using query params, use for FeedFeedback
 * and other ephemeral non-critical systems.
 */

type Source = {
  post: AppBskyFeedDefs.FeedViewPost
  feed?: FeedDescriptor
}

const SetUnstablePostSourceContext = createContext<
  (key: string, source: Source) => void
>(() => {})
const ConsumeUnstablePostSourceContext = createContext<
  (uri: string) => Source | undefined
>(() => undefined)

export function Provider({children}: {children: React.ReactNode}) {
  const sourcesRef = useRef<Map<string, Source>>(new Map())

  const setUnstablePostSource = useCallback((key: string, source: Source) => {
    sourcesRef.current.set(key, source)
  }, [])

  const consumeUnstablePostSource = useCallback((uri: string) => {
    const source = sourcesRef.current.get(uri)
    if (source) {
      sourcesRef.current.delete(uri)
    }
    return source
  }, [])

  return (
    <SetUnstablePostSourceContext.Provider value={setUnstablePostSource}>
      <ConsumeUnstablePostSourceContext.Provider
        value={consumeUnstablePostSource}>
        {children}
      </ConsumeUnstablePostSourceContext.Provider>
    </SetUnstablePostSourceContext.Provider>
  )
}

export function useSetUnstablePostSource() {
  return useContext(SetUnstablePostSourceContext)
}

/**
 * DANGER - This hook is unstable and should only be used for FeedFeedback
 * and other ephemeral non-critical systems. Does not change when the URI changes.
 */
export function useUnstablePostSource(uri: string) {
  const consume = useContext(ConsumeUnstablePostSourceContext)

  const [source] = useState(() => consume(uri))
  return source
}
