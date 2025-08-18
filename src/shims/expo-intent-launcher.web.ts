// Minimal web shim for expo-intent-launcher so web bundles can resolve the import.
// On web, these APIs are no-ops because Android intents are not available.

export async function getApplicationIconAsync(
  _packageName: string,
): Promise<string | null> {
  return null
}

export async function startActivityAsync(
  _action: string,
  _options?: unknown,
): Promise<void> {
  return
}

export default {
  getApplicationIconAsync,
  startActivityAsync,
}
