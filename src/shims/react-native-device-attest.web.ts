// Web shim for react-native-device-attest. These APIs are native-only.
// On web, they should never be called; we provide stubs to satisfy bundling.

type IntegrityResult = {token: string; payload: string}

async function warmupIntegrity(_projectId: number): Promise<void> {
  return
}

async function getDeviceCheckToken(): Promise<string> {
  throw new Error('getDeviceCheckToken is not available on web')
}

async function getIntegrityToken(
  _nonceNamespace: string,
): Promise<IntegrityResult> {
  throw new Error('getIntegrityToken is not available on web')
}

const ReactNativeDeviceAttest = {
  warmupIntegrity,
  getDeviceCheckToken,
  getIntegrityToken,
}

export default ReactNativeDeviceAttest
