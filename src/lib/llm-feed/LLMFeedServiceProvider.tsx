import React from 'react';
import {llmFeedService} from './feed-service';
import {useSession, useAgent} from '#/state/session';
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
  const session = useSession();
  const {data: preferences} = usePreferencesQuery();
  
  // Get the agent directly from the AgentContext
  // This will throw an error if used outside SessionProvider
  let agent = null;
  try {
    agent = useAgent();
  } catch (error) {
    console.log('LLMFeedServiceProvider: Agent not available yet');
  }
  
  // Inject agent whenever it changes
  React.useEffect(() => {
    console.log('LLMFeedServiceProvider: Session state:', {
      hasSession: session.hasSession,
      currentAccount: !!session.currentAccount,
      agentAvailable: !!agent
    });
    
    // Use the agent directly from the useAgent hook
    if (agent) {
      console.log('LLMFeedServiceProvider: Setting agent dependency');
      llmFeedService.setAgent(agent);
    }
  }, [session, agent]);
  
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