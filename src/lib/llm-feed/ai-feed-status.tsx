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

  return (
    <AIFeedStatusContext.Provider value={{status, setStatus, updateStatus}}>
      {children}
    </AIFeedStatusContext.Provider>
  )
}

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
    } else if (hasData && !isEmpty) {
      // Posts are visible - all is well from user perspective
      ctx.updateStatus.markWorking()
    } else if (isFetching || !hasData) {
      // Still loading initial posts or no data yet
      ctx.updateStatus.markInProgress()
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
