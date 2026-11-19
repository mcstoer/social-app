import {
  AuthenticationRequestOrdinalVDXFObject,
  type GenericRequest,
} from 'verus-typescript-primitives'

/**
 * When a request stops being valid, in milliseconds since the epoch.
 *
 * Wallets refuse an authentication request after its expiryTime, so the
 * earliest one in the request wins. A request without one is valid for
 * defaultLifetimeSeconds after createdAt. Returns undefined when the request
 * has neither.
 */
export function getRequestExpiry(
  request: GenericRequest,
  defaultLifetimeSeconds: number,
): number | undefined {
  const authExpiries = (request.details ?? [])
    .filter(
      (detail): detail is AuthenticationRequestOrdinalVDXFObject =>
        detail instanceof AuthenticationRequestOrdinalVDXFObject,
    )
    .map(detail =>
      detail.data.hasExpiryTime()
        ? detail.data.expiryTime?.toNumber()
        : undefined,
    )
    .filter((expiry): expiry is number => expiry !== undefined)

  if (authExpiries.length > 0) {
    return Math.min(...authExpiries) * 1000
  }

  if (request.hasCreatedAt() && request.createdAt) {
    return (request.createdAt.toNumber() + defaultLifetimeSeconds) * 1000
  }

  return undefined
}
