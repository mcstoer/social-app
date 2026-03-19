import {RequestResponseStore} from '#/services/RequestResponseStore'

// Since all the requests and response are the GenericEnvelope, they share the store no matter the details.
export const v2StoreInstance = new RequestResponseStore()
