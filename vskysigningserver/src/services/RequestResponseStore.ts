type Attempt<TRequest, TResponse> = {
  request?: TRequest
  response?: TResponse
  // When the attempt is forgotten, in milliseconds since the epoch.
  expiresAt: number
}

export type RequestResponseStoreOptions = {
  // The longest an attempt is kept after its request is stored.
  ttlMs: number
  // The most attempts kept at once, so the server's memory stays bounded.
  maxAttempts: number
  // Current time in milliseconds. Tests replace it.
  now?: () => number
}

const DEFAULT_OPTIONS: RequestResponseStoreOptions = {
  ttlMs: 60 * 60 * 1000,
  maxAttempts: 10_000,
}

// Thrown when the store already holds maxAttempts attempts that are still valid.
export class StoreFullError extends Error {
  constructor() {
    super('Too many pending requests')
    this.name = 'StoreFullError'
  }
}

// Tracks login and identity update attempts by their IDs,
// storing both the request and the associated response.
// Attempts expire, so a reply only arrives while its request is valid.
export class RequestResponseStore<TIdentifier, TRequest, TResponse> {
  private store: Map<TIdentifier, Attempt<TRequest, TResponse>>
  private options: RequestResponseStoreOptions

  constructor(options: Partial<RequestResponseStoreOptions> = {}) {
    this.store = new Map()
    this.options = {...DEFAULT_OPTIONS, ...options}
  }

  // Creates a new attempt and initializes it with the request. It is kept
  // until expiresAt, but never longer than ttlMs.
  setRequest(id: TIdentifier, request: TRequest, expiresAt?: number): void {
    this.removeExpired()

    if (!this.store.has(id) && this.store.size >= this.options.maxAttempts) {
      throw new StoreFullError()
    }

    const latest = this.now() + this.options.ttlMs
    this.store.set(id, {
      request,
      response: undefined,
      expiresAt: Math.min(expiresAt ?? latest, latest),
    })
  }

  // Like setRequest, but never replaces an attempt that is still valid.
  // Returns false when one exists.
  addRequest(id: TIdentifier, request: TRequest, expiresAt?: number): boolean {
    if (this.hasAttempt(id)) {
      return false
    }

    this.setRequest(id, request, expiresAt)
    return true
  }

  hasAttempt(id: TIdentifier): boolean {
    return this.getAttempt(id) !== undefined
  }

  getAttempt(id: TIdentifier): Attempt<TRequest, TResponse> | undefined {
    const attempt = this.store.get(id)

    if (attempt && attempt.expiresAt <= this.now()) {
      this.store.delete(id)
      return undefined
    }

    return attempt
  }

  setResponse(id: TIdentifier, response: TResponse): void {
    const attempt = this.getAttempt(id)

    if (!attempt) {
      throw new Error(`No attempt found for ID of: ${String(id)}`)
    }

    this.store.set(id, {
      ...attempt,
      response,
    })
  }

  private now(): number {
    return this.options.now ? this.options.now() : Date.now()
  }

  private removeExpired(): void {
    const now = this.now()

    for (const [id, attempt] of this.store) {
      if (attempt.expiresAt <= now) {
        this.store.delete(id)
      }
    }
  }
}
