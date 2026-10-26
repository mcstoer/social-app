// Learn more https://docs.expo.io/guides/customizing-metro
import {getBundleModeMetroConfig} from 'react-native-worklets/bundleMode/index.js'
import {type CustomResolver} from '@expo/metro/metro-resolver'
import {getDefaultConfig} from '@expo/metro-config'
import {getSentryExpoConfig} from '@sentry/react-native/metro.js'

let config = getSentryExpoConfig(import.meta.dirname, {
  // TODO: confirm this doesn't break anything when we switch to metro web
  includeWebReplay: false,
  includeWebFeedback: false,
  annotateReactComponents: {
    textComponentNames: ['Text', 'ButtonText'],
  },
  getDefaultConfig: (projectRoot, options) => {
    const config = getDefaultConfig(projectRoot, options)

    if (typeof process.env.RN_SRC_EXT === 'string') {
      // inject `.e2e.ts` and `.e2e.tsx` into the sourceExts when running tests)
      config.resolver.sourceExts.unshift(...process.env.RN_SRC_EXT.split(','))
    }

    config.resolver.assetExts = [...config.resolver.assetExts, 'woff2']

    if (config.resolver.resolveRequest) {
      throw Error('Update this override because it is conflicting now.')
    }

    if (process.env.BSKY_PROFILE) {
      // @ts-expect-error readonly property
      config.cacheVersion += ':PROFILE'
    }

    // Add the Node modules needed by the Verus libraries.
    const nodeModuleAliases: Record<string, string> = {
      crypto: 'crypto-browserify',
      stream: 'stream-browserify',
      vm: 'vm-browserify',
    }

    const resolver: CustomResolver = (context, moduleName, platform) => {
      if (moduleName in nodeModuleAliases) {
        return context.resolveRequest(
          context,
          nodeModuleAliases[moduleName],
          platform,
        )
      }
      /*
       * Use the browser build of axios instead of the Node build, since the
       * Node build needs several Node libraries (url, http2), whereas React
       * Native supports the browser build's requirements.
       */
      if (moduleName === 'axios') {
        return context.resolveRequest(
          context,
          'axios/dist/browser/axios.cjs',
          platform,
        )
      }
      if (
        platform === 'web' &&
        /^react-native-gesture-handler(\/|$)/.test(moduleName)
      ) {
        throw new Error(
          `react-native-gesture-handler must not be imported on web (requested from ${context.originModulePath})`,
        )
      }
      /*
       * react-native-webview has no web implementation (its fallback renders
       * "does not support this platform"), so swap in react-native-web-webview
       * to keep external media embeds working. Mirrors the old webpack alias.
       */
      if (platform === 'web' && moduleName === 'react-native-webview') {
        return context.resolveRequest(
          context,
          'react-native-web-webview',
          platform,
        )
      }
      if (
        process.env.BSKY_PROFILE &&
        moduleName.endsWith('ReactNativeRenderer-prod')
      ) {
        return context.resolveRequest(
          context,
          moduleName.replace('-prod', '-profiling'),
          platform,
        )
      }
      return context.resolveRequest(context, moduleName, platform)
    }

    // @ts-expect-error readonly property
    config.resolver.resolveRequest = resolver

    config.transformer.getTransformOptions = () =>
      Promise.resolve({
        transform: {
          experimentalImportSupport: true,
          inlineRequires: true as false, // ??? typescript why?
        },
      })

    /*
     * Keep the names of these crypto classes, since @bitgo/utxo-lib checks
     * them with `constructor.name`. BigInteger is needed for ParseCompact and
     * Point for recoverFromSignature. Also use keep_fnames, since Metro
     * replaces `mangle.reserved` with its own list.
     */
    const {minifierConfig} = config.transformer
    const keepFnames = /^(BigInteger|Point)$/
    // @ts-expect-error readonly property
    config.transformer.minifierConfig = {
      ...minifierConfig,
      mangle: {
        ...(minifierConfig.mangle as Record<string, unknown> | undefined),
        keep_fnames: keepFnames,
      },
      compress: {
        ...(minifierConfig.compress as Record<string, unknown> | undefined),
        keep_fnames: keepFnames,
      },
    }

    return config as unknown as Record<string, unknown>
  },
})

/*
 * The package's types declare this with no parameters and don't resolve for
 * the `/index.js` import path.
 */
// oxlint-disable-next-line typescript/no-unsafe-call
config = getBundleModeMetroConfig(config)

export default config
