import {View} from 'react-native'

import {getStatusColor, useAIFeedStatus} from '#/lib/llm-feed/ai-feed-status'

interface AIFeedStatusIndicatorProps {
  size?: number
  style?: any
}

export function AIFeedStatusIndicator({
  size = 8,
  style,
}: AIFeedStatusIndicatorProps) {
  const {status} = useAIFeedStatus()

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: getStatusColor(status),
          marginLeft: 6,
        },
        style,
      ]}
    />
  )
}

// Hook to get the display name with status indicator
export function useAIFeedDisplayName(): string {
  const {status} = useAIFeedStatus()

  // Add a visual indicator to the text for accessibility
  const statusEmoji = {
    in_progress: '🟡',
    working: '🟢',
    failing: '🔴',
  }[status]

  return `AI Mode ${statusEmoji}`
}
