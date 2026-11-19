import {GenericRequest, ResponseURI} from 'verus-typescript-primitives'

import {getRequestExpiry} from '#/api/v2/helpers/requestExpiry'
import {StoreFullError} from '#/services/RequestResponseStore'

// Allows for clocks that run a little apart.
const MAX_CLOCK_SKEW_SECONDS = 60

export type RegisterResult = {
  success: boolean
  status: number
  message: string
}

// The store calls the service needs. Matches RequestResponseStore.
export type RequestStore = {
  hasAttempt(id: string): boolean
  addRequest(id: string, request: GenericRequest, expiresAt?: number): boolean
}

export type RequestsServiceOptions = {
  store: RequestStore
  // Requests must name this app in appOrDelegatorID.
  appID: string
  // Requests must be signed for this chain.
  systemID: string
  // The oldest a request may be when it is registered, and how long one
  // without an expiry of its own stays valid.
  maxAgeSeconds: number
  // Checks the request's signature, as a wallet will.
  verifySignature: (request: GenericRequest) => Promise<boolean>
  // Current time in milliseconds. Tests replace it.
  now?: () => number
}

/**
 * Registers requests that the user's own Verus daemon signed, so their replies
 * can be received here like replies to requests this server signed.
 *
 * Only requests for this app, on this chain, still valid and validly signed
 * are kept, and only until they expire.
 */
export class RequestsService {
  constructor(private readonly options: RequestsServiceOptions) {}

  async registerRequest(buffer: unknown): Promise<RegisterResult> {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      return fail(400, 'Missing request.')
    }

    const request = new GenericRequest()
    try {
      if (request.fromBuffer(buffer) !== buffer.length) {
        return fail(400, 'Malformed request.')
      }
    } catch {
      return fail(400, 'Malformed request.')
    }

    const id = request.requestID?.toAddress()
    if (!request.hasRequestID() || !id) {
      return fail(400, 'Missing requestID.')
    }

    const invalid = this.checkRequest(request)
    if (invalid) {
      log(`Rejected request with id ${id}: ${invalid.message}`)
      return invalid
    }

    const expiresAt = getRequestExpiry(request, this.options.maxAgeSeconds)
    if (expiresAt === undefined || expiresAt <= this.now()) {
      log(`Rejected expired request with id ${id}`)
      return fail(400, 'The request has expired.')
    }

    // Cheap check first, so a known request costs no signature check.
    if (this.options.store.hasAttempt(id)) {
      return fail(409, 'This request is already registered.')
    }

    let isValid: boolean
    try {
      isValid = await this.options.verifySignature(request)
    } catch (error) {
      console.error(`Could not verify request ${id}:`, error)
      return fail(503, 'Could not verify the request signature.')
    }

    if (!isValid) {
      log(`Rejected request with an invalid signature, id ${id}`)
      return fail(400, 'Invalid request signature.')
    }

    try {
      if (!this.options.store.addRequest(id, request, expiresAt)) {
        return fail(409, 'This request is already registered.')
      }
    } catch (error) {
      if (error instanceof StoreFullError) {
        return fail(503, 'Too many pending requests. Try again later.')
      }
      throw error
    }

    log(`Registered request with id ${id}`)
    return {success: true, status: 201, message: 'Request registered.'}
  }

  // Returns why the request can't be registered, or nothing if it can.
  private checkRequest(request: GenericRequest): RegisterResult | undefined {
    const {appID, systemID, maxAgeSeconds} = this.options

    if (!request.isSigned() || !request.signature) {
      return fail(400, 'The request is not signed.')
    }

    if (
      !request.hasAppOrDelegatorID() ||
      request.appOrDelegatorID?.toIAddress() !== appID
    ) {
      return fail(400, 'The request is not for this app.')
    }

    if (request.signature.systemID.toIAddress() !== systemID) {
      return fail(400, 'The request is signed for another chain.')
    }

    // Only requests that ask for their reply to be posted can get one here.
    const postsReply = request.responseURIs?.some(uri =>
      uri.type.eq(ResponseURI.TYPE_POST),
    )
    if (!postsReply) {
      return fail(400, 'The request does not post its reply.')
    }

    if (!request.hasCreatedAt() || !request.createdAt) {
      return fail(400, 'Missing createdAt.')
    }

    const ageSeconds = this.now() / 1000 - request.createdAt.toNumber()
    if (ageSeconds > maxAgeSeconds || ageSeconds < -MAX_CLOCK_SKEW_SECONDS) {
      return fail(400, 'The request is too old or dated in the future.')
    }

    return undefined
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now()
  }
}

function fail(status: number, message: string): RegisterResult {
  return {success: false, status, message}
}

function log(message: string) {
  console.log(`${message} at ${new Date().toLocaleTimeString()}`)
}
