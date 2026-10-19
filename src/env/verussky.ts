import {type DidString, ensureValidDid} from '@atproto/syntax'

import {processIAddress} from '#/lib/verus/addresses'
import configJson from './verussky.config.json'

type ServerDescription = (typeof configJson)['serverDescription']

export type VerusSkyConfig = Omit<typeof configJson, 'serverDescription'> & {
  serverDescription: Omit<ServerDescription, 'did'> & {did: DidString}
}

const {did} = configJson.serverDescription
/*
 * Throw at startup if the config has a bad DID. Otherwise logging in, signing
 * up or changing a handle would fail later.
 */
ensureValidDid(did)

export const VERUSSKY_CONFIG: VerusSkyConfig = {
  ...configJson,
  serverDescription: {...configJson.serverDescription, did},
}

/**
 * The chain to use for Verus operations.
 */
export const DEFAULT_CHAIN: string =
  process.env.EXPO_PUBLIC_DEFAULT_CHAIN || 'VRSCTEST'

const appId = process.env.EXPO_PUBLIC_VERUSSKY_APP_ID
/*
 * Name the missing env var. Otherwise processIAddress throws a vague
 * "Invalid name" error.
 */
if (!appId) {
  throw new Error('EXPO_PUBLIC_VERUSSKY_APP_ID is not set')
}

/**
 * The iaddress or name of the application's identity.
 */
export const VERUSSKY_APP_ID = processIAddress(appId, DEFAULT_CHAIN)
