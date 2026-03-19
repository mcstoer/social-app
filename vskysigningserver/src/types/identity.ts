import {type IdentityDefinition} from 'verus-typescript-primitives'

export interface Identity {
  fullyqualifiedname: string
  identity: IdentityDefinition
  [key: string]: unknown
}

export interface BlockInfo {
  time: number
  height: number
  [key: string]: unknown
}
