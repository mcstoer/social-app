import React, {createContext, type ReactNode, useContext, useState} from 'react'

export type AIFeedStatus = 'in_progress' | 'working' | 'failing'

interface AIFeedStatusContextType {
  status: AIFeedStatus
  setStatus: (status: AIFeedStatus) => void
  updateStatus: {
    markInProgress: () => void
    markWorking: () => void
    markFailing: () => void
  }
}

const AIFeedStatusContext = createContext<AIFeedStatusContextType | undefined>(
  undefined,
)

export function AIFeedStatusProvider({children}: {children: ReactNode}) {
  const [status, setStatus] = useState<AIFeedStatus>('in_progress')

  const updateStatus = {
    markInProgress: () => setStatus('in_progress'),
    markWorking: () => setStatus('working'),
    markFailing: () => setStatus('failing'),
  }

  // Keep external setter reference in sync for non-React callers
  React.useEffect(() => {
    latestSetStatusRef = setStatus
    return () => {
      if (latestSetStatusRef === setStatus) {
        latestSetStatusRef = null
      }
    }
  }, [setStatus])

  return (
    <AIFeedStatusContext.Provider value={{status, setStatus, updateStatus}}>
      {children}
    </AIFeedStatusContext.Provider>
  )
}

// --- External control API ---------------------------------------------------
// Allows non-React codepaths (e.g., background fetchers/curators) to update
// the status indicator when they observe hard failures like 401s.

let latestSetStatusRef: ((status: AIFeedStatus) => void) | null = null

// Capture the latest setStatus from the mounted provider
export function registerAIFeedStatusSetter(
  setter: (status: AIFeedStatus) => void,
) {
  latestSetStatusRef = setter
}

// Utility fns for external callers
export function markAIFeedFailing() {
  latestSetStatusRef?.('failing')
}

export function markAIFeedInProgress() {
  latestSetStatusRef?.('in_progress')
}

export function markAIFeedWorking() {
  latestSetStatusRef?.('working')
}

// Keep latest setter in sync with the mounted provider
// Note: using a separate function to avoid changing the provider signature
// Deprecated: prefer provider-managed registration above
export function useSyncAIFeedStatusSetter() {}

export function useAIFeedStatus() {
  const context = useContext(AIFeedStatusContext)
  if (context === undefined) {
    throw new Error(
      'useAIFeedStatus must be used within an AIFeedStatusProvider',
    )
  }
  return context
}

// Hook to track AI feed loading state based on user-visible feed status
export function useAIFeedStatusTracker(
  feed: string,
  isFetching: boolean,
  isError: boolean,
  hasData: boolean,
  isEmpty: boolean,
) {
  // Access context directly so this hook becomes a no-op if the provider is not mounted
  const ctx = React.useContext(AIFeedStatusContext)

  React.useEffect(() => {
    // Only track status for AI mode feed
    if (feed !== 'ai-mode-feed') return
    // If provider isn't present, quietly skip
    if (!ctx) return

    if (isError) {
      ctx.updateStatus.markFailing()
      return
    }

    if (hasData && !isEmpty) {
      // Posts are visible - all is well from user perspective
      ctx.updateStatus.markWorking()
      return
    }

    if (isFetching || !hasData) {
      // Still loading initial posts or no data yet
      if (ctx.status !== 'failing') {
        ctx.updateStatus.markInProgress()
      }
    }
  }, [feed, isFetching, isError, hasData, isEmpty, ctx])
}

// Utility function to get status color
export function getStatusColor(status: AIFeedStatus): string {
  switch (status) {
    case 'in_progress':
      return '#f59e0b' // Yellow
    case 'working':
      return '#10b981' // Green
    case 'failing':
      return '#ef4444' // Red
    default:
      return '#6b7280' // Gray fallback
  }
}
