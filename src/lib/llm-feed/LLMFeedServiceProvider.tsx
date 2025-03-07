import React from 'react';
import {llmFeedService} from './feed-service';
import {useSession} from '#/state/session';
import {usePreferencesQuery} from '#/state/queries/preferences';

// Create context to share the LLM feed service instance
const LLMFeedServiceContext = React.createContext<typeof llmFeedService | null>(null);

/**
 * Provider component that injects dependencies into the LLM feed service
 * and makes it available through the context
 */
export function LLMFeedServiceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get dependencies from React hooks
  const {agent} = useSession();
  const {data: preferences} = usePreferencesQuery();
  
  // Inject agent whenever it changes
  React.useEffect(() => {
    if (agent) {
      console.log('LLMFeedServiceProvider: Setting agent dependency');
      llmFeedService.setAgent(agent);
    }
  }, [agent]);
  
  // Inject preferences whenever they change
  React.useEffect(() => {
    if (preferences) {
      console.log('LLMFeedServiceProvider: Setting preferences dependency');
      llmFeedService.setPreferences(preferences);
    }
  }, [preferences]);
  
  return (
    <LLMFeedServiceContext.Provider value={llmFeedService}>
      {children}
    </LLMFeedServiceContext.Provider>
  );
}

/**
 * Hook to use the LLM feed service
 * Must be used within a LLMFeedServiceProvider
 */
export function useLLMFeedService() {
  const service = React.useContext(LLMFeedServiceContext);
  
  if (!service) {
    throw new Error('useLLMFeedService must be used within a LLMFeedServiceProvider');
  }
  
  return service;
}