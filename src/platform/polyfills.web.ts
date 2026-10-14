import 'array.prototype.findlast/auto'
import 'array.prototype.findlastindex/auto'
import 'setimmediate'

import {Buffer} from 'buffer'
import processPolyfill from 'process'

if (window) {
  // Add to fix for Buffer being undefined.
  window.Buffer = Buffer
}

/*
 * Metro's prelude only has process.env on web, but the Verus libraries need
 * other process variables so we fill in what's missing.
 */
window.process = {...processPolyfill, ...window.process}

/*
 * NOTE: the webpack-era console.error wrapper that re-threw react-native-web's
 * "Unexpected text node" warnings as redboxes was removed with the Metro
 * migration. Metro's LogBox already surfaces console.error prominently, and
 * any wrapper around console.error becomes the top stack frame of every
 * captured error, making Metro attribute all of them to this file.
 */

export {}
