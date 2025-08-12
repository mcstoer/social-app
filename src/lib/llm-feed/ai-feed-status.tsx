import {createContext, type ReactNode, useContext, useState} from 'react'

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
