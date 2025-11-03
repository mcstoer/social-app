import {type AppBskyFeedDefs, AppBskyFeedPost} from '@atproto/api'
import {type VerusIdInterface} from 'verusid-ts-client'

import * as bsky from '#/types/bsky'

export interface VerusIdLink {
  message: string
  identity: string
  signature: string
  postUri: string
}

function findVerusIdLink(
  posts: AppBskyFeedDefs.PostView[],
  linkIdentifier: string,
  handle: string,
): VerusIdLink | null {
  // The link is in the format of
  // linkId 1: controller of VerusID "${name}" controls ${handle}:${signature}
  const regexSafeHandle = handle.replace(/\./g, '\\.')
  const verusIdLinkPattern = new RegExp(
    `(${linkIdentifier} 1: controller of VerusID "([^"]+)" controls ${regexSafeHandle}):(\\S+)`,
    'm',
  )

  for (const post of posts) {
    const record = bsky.validate(post.record, AppBskyFeedPost.validateRecord)
      ? post.record
      : undefined

    if (record) {
      const text = record.text
      if (text) {
        const match = text.match(verusIdLinkPattern)

        if (match) {
          return {
            message: match[1],
            identity: match[2],
            signature: match[3],
            postUri: post.uri,
          }
        }
      }
    }
  }

  return null
}

async function verifyVerusIdLink(
  verusIdInterface: VerusIdInterface,
  link: VerusIdLink,
): Promise<boolean> {
  try {
    const verified = await verusIdInterface.verifyMessage(
      link.identity,
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
  posts: AppBskyFeedDefs.PostView[],
  linkIdentifier: string,
  verusIdInterface: VerusIdInterface,
  handle?: string,
): Promise<VerusIdLink | null> {
  if (!handle) {
    throw new Error('No handle provided to check the linked VerusID')
  }

  const link = findVerusIdLink(posts, linkIdentifier, handle)

  if (!link) {
    return null
  }

  const verified = await verifyVerusIdLink(verusIdInterface, link)

  if (!verified) {
    return null
  }

  return link
}
