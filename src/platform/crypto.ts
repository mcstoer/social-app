// HACK
// expo-modules-core tries to require('crypto') in uuid.web.js
// and while it tries to detect web crypto before doing so, our
// build fails when it tries to do this require. We use a babel
// and tsconfig alias to direct it here
// -prf
// Since VerusSky uses crypto from crypto-browserify, we can point
// it to the polyfill instead. If this polyfill is removed, revert
// back to the web crypto.
export {default} from 'crypto-browserify'
