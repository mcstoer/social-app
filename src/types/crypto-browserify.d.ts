declare module 'crypto-browserify' {
  const crypto: typeof import('node:crypto')
  export = crypto
}
