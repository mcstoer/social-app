import {type AppBskyActorDefs} from '@atproto/api'
import {type VerusIdInterface} from 'verusid-ts-client'

export async function checkIfLinkedVerusID(
  profile: AppBskyActorDefs.ProfileViewDetailed,
  verusIdInterface: VerusIdInterface,
): Promise<{
  isLinked: boolean
  message?: string
  name?: string
  signature?: string
}> {
  const description = profile.description
  const handle = profile.handle

  if (!description || !handle) {
    return {isLinked: false}
  }

  // The link is `iBnLtVL69rXXZtjEVndYahV5EgKeWi4GS4 1: controller of VerusID "${name}" controls ${handle}:${signature}`
  const verusIdPattern = new RegExp(
    `^(iBnLtVL69rXXZtjEVndYahV5EgKeWi4GS4\\s+1:\\s*controller of VerusID "([^"]+)" controls ${handle.replace(/\./g, '\\.')}):(\\S+)$`,
    'm',
  )

  const match = description.match(verusIdPattern)

  if (!match) {
    return {isLinked: false}
  }

  const message = match[1]
  const name = match[2]
  const signature = match[3]

  const verified = await verusIdInterface.verifyMessage(
    name,
    signature,
    message,
  )

  if (!verified) {
    return {isLinked: false}
  }

  return {
    isLinked: true,
    message: match[1],
    name: match[2],
    signature: match[3],
  }
}
