// HACK
// expo-modules-core tries to require('crypto') in uuid.web.js
// and while it tries to detect web crypto before doing so, our
// build fails when it tries to do this require. We use a babel
// and tsconfig alias to direct it here
// -prf
// Since VerusSky uses crypto from crypto-browserify, we can point
// it to the polyfill instead. If this polyfill is removed, revert
// back to the web crypto.
import crypto from 'crypto-browserify'

export default crypto

/*
 * Export the functions by name too, since libraries like @bitgo/utxo-lib call
 * `require('crypto').createHash` and that only sees named exports.
 * Note: Add more here if another library needs them.
 */
export const {
  createHash,
  createHmac,
  pbkdf2,
  pbkdf2Sync,
  randomBytes,
  randomFillSync,
  getHashes,
} = crypto
