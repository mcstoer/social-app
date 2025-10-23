import {type AppBskyActorDefs} from '@atproto/api'
import {type VerusIdInterface} from 'verusid-ts-client'

interface VerusIdLink {
  message: string
  name: string
  signature: string
}

export function findVerusIdLink(
  profile: AppBskyActorDefs.ProfileViewDetailed,
): VerusIdLink | null {
  const description = profile.description
  const handle = profile.handle

  // The link is in the format of
  // iBnLtVL69rXXZtjEVndYahV5EgKeWi4GS4 1: controller of VerusID "${name}" controls ${handle}:${signature}
  const regexSafeHandle = handle.replace(/\./g, '\\.')
  const verusIdLinkPattern = new RegExp(
    `^(iBnLtVL69rXXZtjEVndYahV5EgKeWi4GS4 1: controller of VerusID "([^"]+)" controls ${regexSafeHandle}):(\\S+)$`,
    'm',
  )

  if (!description) {
    return null
  }

  const match = description.match(verusIdLinkPattern)

  if (!match) {
    return null
  }

  return {
    message: match[1],
    name: match[2],
    signature: match[3],
  }
}

async function verifyVerusIdLink(
  verusIdInterface: VerusIdInterface,
  link: VerusIdLink,
): Promise<boolean> {
  try {
    const verified = await verusIdInterface.verifyMessage(
      link.name,
      link.signature,
      link.message,
    )
    return verified
  } catch (error) {
    console.error('Failed to verify VerusID link:', error)
    throw error
  }
}

export async function checkIfLinkedVerusID(
  profile: AppBskyActorDefs.ProfileViewDetailed,
  verusIdInterface: VerusIdInterface,
): Promise<{
  isLinked: boolean
  message?: string
  name?: string
  signature?: string
}> {
  const link = findVerusIdLink(profile)

  if (!link) {
    return {isLinked: false}
  }

  const verified = await verifyVerusIdLink(verusIdInterface, link)

  if (!verified) {
    return {isLinked: false}
  }

  return {
    isLinked: true,
    message: link.message,
    name: link.name,
    signature: link.signature,
  }
}
