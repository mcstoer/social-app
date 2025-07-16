import React, {useEffect, useRef} from 'react'

// import { LLM_API_KEY, LLM_BASE_URL } from './env'; // Removed import
import {logger} from '#/logger'
import {useAgent, useSession} from '#/state/session'
import {PersonalityUpdater} from './personality-updater'

// Hardcoded values
const HARDCODED_LLM_API_KEY = 'JKNzduptcUlwUvi6gdcSlqBllOgXYyZr'
const HARDCODED_LLM_BASE_URL = 'https://api.deepinfra.com/v1/openai'

const UPDATE_INTERVAL_MS = 10 * 60 * 1000 // 10 minutes

export function usePeriodicPersonalityUpdate() {
  const {hasSession} = useSession()
  const agent = useAgent()
  const updaterRef = useRef<PersonalityUpdater | null>(null)
  const intervalIdRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // Function to start the periodic updates
    const startUpdater = () => {
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

      // Use hardcoded values
      logger.info('PeriodicPersonalityUpdate: Starting periodic updates...')
      updaterRef.current = new PersonalityUpdater(
        HARDCODED_LLM_API_KEY,
        HARDCODED_LLM_BASE_URL,
        agent,
      )

      // Run immediately first time
      updaterRef.current
        .updatePersonality()
        .catch(e =>
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
