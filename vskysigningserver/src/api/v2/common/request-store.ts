import {MAX_PENDING_REQUESTS, REQUEST_TTL_SECONDS} from '#/config'
import {RequestResponseStore} from '#/services/RequestResponseStore'

// Since all the requests and response are the GenericEnvelope, they share the store no matter the details.
export const v2StoreInstance = new RequestResponseStore({
  ttlMs: REQUEST_TTL_SECONDS * 1000,
  maxAttempts: MAX_PENDING_REQUESTS,
})
