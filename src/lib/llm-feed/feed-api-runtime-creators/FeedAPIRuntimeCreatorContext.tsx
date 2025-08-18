/**
 * @fileoverview Provides the React context and provider for FeedAPIRuntimeCreators.
 *
 * This module enables the injection of custom FeedAPIRuntimeCreators into the application's React tree.
 * Consumers can use the `useFeedAPIRuntimeCreator` hook to access the provided creator.
 */

import {type ReactNode} from 'react';
import { createContext, useContext } from 'react';
import type React from 'react';

import { usePreferencesQuery,type UsePreferencesQueryResponse } from '#/state/queries/preferences';
import  { type FeedAPIRuntimeCreator } from './FeedAPIRuntimeCreator';

/**
 * React context for FeedAPIRuntimeCreators.
 */
const FeedAPIRuntimeCreatorContext = createContext<FeedAPIRuntimeCreator | undefined>(undefined);

/**
 * Props for the FeedAPIRuntimeCreatorProvider component.
 */
interface FeedAPIRuntimeCreatorProviderProps {
  /**
   * The FeedAPIRuntimeCreator instance to provide to the context.
   */
  runtimeCreator: FeedAPIRuntimeCreator;

  /**
   * The child components to render within the provider.
   */
  children: ReactNode;
}

/**
 * Provides a FeedAPIRuntimeCreator to the React context.
 */
export const FeedAPIRuntimeCreatorProvider: React.FC<FeedAPIRuntimeCreatorProviderProps> = ({ runtimeCreator, children }) => {
  return (
    <FeedAPIRuntimeCreatorContext.Provider value={runtimeCreator}>
      {children}
    </FeedAPIRuntimeCreatorContext.Provider>
  );
};

// Hacky workaround with React Hooks restrictions: store the preferences and let creators
// use all the last preferences instance.
export let preferences: UsePreferencesQueryResponse | null = null;

/**
 * Custom hook to access the FeedAPIRuntimeCreator from the context.
 *
 * @returns The FeedAPIRuntimeCreator instance from the context, or undefined if not provided.
 */
export const useFeedAPIRuntimeCreator = (): FeedAPIRuntimeCreator | undefined => {
  const runtimeCreator = useContext(FeedAPIRuntimeCreatorContext);
  const { data: preferencesResult } = usePreferencesQuery();

  // Collect preferences before allowing access to the creator as many depends on it.
  if (preferencesResult != null) {
    preferences = preferencesResult;
  }

  return runtimeCreator;
};