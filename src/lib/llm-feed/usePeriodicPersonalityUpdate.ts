import {useEffect, useRef} from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'

import {logger} from '#/logger'
import {useAgent, useSession} from '#/state/session'
import {LLM_API_KEY, LLM_BASE_URL} from './env'
import {PersonalityUpdater} from './personality-updater'

// AsyncStorage keys (consistent with PersonalitySettings.tsx and ShellAIFeedAPI.ts)
const LLM_API_KEY_STORAGE_KEY = 'llm_api_key'
const LLM_BASE_URL_STORAGE_KEY = 'llm_base_url'

const UPDATE_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

export function usePeriodicPersonalityUpdate() {
  const {hasSession} = useSession()
  const agent = useAgent()
  const updaterRef = useRef<PersonalityUpdater | null>(null)
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Function to start the periodic updates
    const startUpdater = async () => {
      if (intervalIdRef.current) {
        logger.debug('PeriodicPersonalityUpdate: Already running.')
        return // Already running
      }
      if (!hasSession || !agent?.session) {
        logger.debug(
          'PeriodicPersonalityUpdate: No session, updater not started.',
        )
        return // No session, don't start
      }

      // Load configuration with proper priority: AsyncStorage → env.ts → abort
      let apiKey = LLM_API_KEY
      let baseUrl = LLM_BASE_URL

      try {
        const storedApiKey = await AsyncStorage.getItem(LLM_API_KEY_STORAGE_KEY)
        const storedBaseUrl = await AsyncStorage.getItem(
          LLM_BASE_URL_STORAGE_KEY,
        )

        if (storedApiKey) {
          apiKey = storedApiKey
        }

        if (storedBaseUrl) {
          baseUrl = storedBaseUrl
        }

        logger.debug('PeriodicPersonalityUpdate: Using API key from:', {
          source: storedApiKey ? 'AsyncStorage' : 'env.ts',
        })
        logger.debug('PeriodicPersonalityUpdate: Using base URL:', {baseUrl})
      } catch (error) {
        logger.warn(
          'PeriodicPersonalityUpdate: Failed to load settings from AsyncStorage, using env.ts defaults',
          {error},
        )
      }

      if (!apiKey || !baseUrl) {
        logger.error(
          'PeriodicPersonalityUpdate: LLM API Key or Base URL missing, cannot start updater.',
        )
        return
      }

      logger.info('PeriodicPersonalityUpdate: Starting periodic updates...')
      updaterRef.current = new PersonalityUpdater(apiKey, baseUrl, agent)

      // Run immediately first time
      updaterRef.current.updatePersonality().catch(e =>
        logger.error('PeriodicPersonalityUpdate: Initial update failed', {
          error: e,
        }),
      )

      // Then set interval
      intervalIdRef.current = setInterval(() => {
        if (updaterRef.current) {
          logger.debug(
            'PeriodicPersonalityUpdate: Triggering scheduled update.',
          )
          updaterRef.current
            .updatePersonality()
            .catch(e =>
              logger.error(
                'PeriodicPersonalityUpdate: Scheduled update failed',
                {error: e},
              ),
            )
        } else {
          logger.warn(
            'PeriodicPersonalityUpdate: Interval running but updater is null.',
          )
        }
      }, UPDATE_INTERVAL_MS)
    }

    // Function to stop the periodic updates
    const stopUpdater = () => {
      if (intervalIdRef.current) {
        logger.info('PeriodicPersonalityUpdate: Stopping periodic updates.')
        clearInterval(intervalIdRef.current)
        intervalIdRef.current = null
        updaterRef.current = null
      }
    }

    // Start or stop based on session status
    if (hasSession) {
      startUpdater()
    } else {
      stopUpdater()
    }

    // Cleanup on unmount
    return () => {
      stopUpdater()
    }
  }, [hasSession, agent]) // Rerun effect if session or agent changes
}
