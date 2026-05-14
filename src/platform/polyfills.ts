import 'fast-text-encoding'
// The crypto polyfill needs getRandomValues on mobile, so we add it here.
import 'react-native-get-random-values'

export {}

// Fix Buffer in react native.
global.Buffer = global.Buffer || require('buffer').Buffer

// @ts-expect-error
// crypto-browserify uses browserify-sign, which in turn uses the older readable-stream@2.x.
// readable-stream@2.x slices the process version in lib/_stream_writable.js line 57 during module evaluation.
// process.version is undefined in react native, so we set a value before crypto-browserify is imported.
global.process.version ??= ''
