type Attempt<TRequest, TResponse> = {
  request?: TRequest
  response?: TResponse
}

// Tracks login and identity update attempts by their IDs,
// storing both the request and the associated response.
export class RequestResponseStore<TIdentifier, TRequest, TResponse> {
  private store: Map<TIdentifier, Attempt<TRequest, TResponse>>

  constructor() {
    this.store = new Map()
  }

  // Creates a new attempt and initializes it with the request.
  setRequest(id: TIdentifier, request: TRequest): void {
    const attempt: Attempt<TRequest, TResponse> = {
      request: request,
      response: undefined,
    }
    this.store.set(id, attempt)
  }

  hasAttempt(id: TIdentifier): boolean {
    return this.store.has(id)
  }

  getAttempt(id: TIdentifier): Attempt<TRequest, TResponse> | undefined {
    return this.store.get(id)
  }

  setResponse(id: TIdentifier, response: TResponse): void {
    const attempt = this.store.get(id)

    if (!attempt) {
      throw new Error(`No attempt found for ID of: ${id}`)
    }

    this.store.set(id, {
      ...attempt,
      response: response,
    })
  }
}
