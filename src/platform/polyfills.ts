import 'react-native-url-polyfill/auto'
import 'fast-text-encoding'
export {}

// Fix Buffer in react native.
global.Buffer = global.Buffer || require('buffer').Buffer
