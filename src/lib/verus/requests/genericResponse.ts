import {
  DataResponseOrdinalVDXFObject,
  type GenericResponse,
} from 'verus-typescript-primitives'

// Creates a map of data response ordinals to their request IDs for quick lookup.
export function buildDataResponseMap(
  response: GenericResponse,
): Map<string, DataResponseOrdinalVDXFObject> {
  const dataResponseMap = new Map<string, DataResponseOrdinalVDXFObject>()

  for (const ordinal of response.details) {
    if (
      ordinal instanceof DataResponseOrdinalVDXFObject &&
      ordinal.data.requestID
    ) {
      dataResponseMap.set(ordinal.data.requestID.toIAddress(), ordinal)
    }
  }

  return dataResponseMap
}
