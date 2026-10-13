import {forwardRef, useCallback, useEffect, useState} from 'react'
import {
  AccessibilityInfo,
  Image as RNImage,
  useColorScheme,
  View,
} from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import Svg, {Path, type SvgProps} from 'react-native-svg'
import {scheduleOnRN} from 'react-native-worklets'
import {Image} from 'expo-image'
import * as SplashScreen from 'expo-splash-screen'

import {Logotype} from '#/view/icons/Logotype'
import {atoms as a} from '#/alf'
// @ts-expect-error
import splashImagePointer from '../assets/splash/splash.png'
// @ts-expect-error
import darkSplashImagePointer from '../assets/splash/splash-dark.png'

const splashImageUri = RNImage.resolveAssetSource(splashImagePointer)!.uri
const darkSplashImageUri = RNImage.resolveAssetSource(
  darkSplashImagePointer,
)!.uri

export const Logo = forwardRef(function LogoImpl(props: SvgProps, ref) {
  const width = 1000
  const height = width * (201 / 201)
  return (
    <Svg
      fill="none"
      // @ts-expect-error it's fiiiiine
      ref={ref}
      viewBox="0 0 201 201"
      style={[{width, height}, props.style]}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        fill={props.fill || '#fff'}
        d="M100.5 0C155.968 0 201 45.0324 201 100.5C201 155.967 155.967 201 100.5 201C45.0326 201 0 155.968 0 100.5C0 45.0327 45.0326 0 100.5 0ZM51.2278 36.3533C55.0232 33.1034 60.3483 30.4339 64.9778 32.3137C73.3023 35.6939 95.6682 80.7852 95.6682 80.7852C95.6682 80.7852 126.953 36.3395 138.189 32.2864C142.022 30.9038 147.278 33.3358 151.286 36.3322C165.353 46.8492 166.806 61.5218 165.59 65.5923C164.062 70.7098 86.3523 169.309 86.3523 169.309C84.0283 168.361 37.9847 82.9026 35.4895 68.2802C33.105 54.3063 41.2179 44.8116 51.2278 36.3533V36.3533Z"
      />
    </Svg>
  )
})

type Props = {
  isReady: boolean
}

export function Splash(props: React.PropsWithChildren<Props>) {
  'use no memo'
  const insets = useSafeAreaInsets()
  const intro = useSharedValue(0)
  const outroLogo = useSharedValue(0)
  const outroApp = useSharedValue(0)
  const outroSplashOpacity = useSharedValue(0)
  const [isAnimationComplete, setIsAnimationComplete] = useState(false)
  const [isImageLoaded, setIsImageLoaded] = useState(false)
  const [isLayoutReady, setIsLayoutReady] = useState(false)
  const [reduceMotion, setReduceMotion] = useState<boolean | undefined>(false)
  const isReady =
    props.isReady &&
    isImageLoaded &&
    isLayoutReady &&
    reduceMotion !== undefined

  const colorScheme = useColorScheme()
  const isDarkMode = colorScheme === 'dark'

  const logoAnimation = useAnimatedStyle(() => {
    const introScale = interpolate(intro.get(), [0, 1], [0.8, 1], 'clamp')
    const outroScale =
      reduceMotion === true
        ? 1
        : interpolate(outroLogo.get(), [0, 0.08, 1], [1, 0.8, 500], 'clamp')

    const introOpacity = interpolate(intro.get(), [0, 1], [0, 1], 'clamp')
    const outroOpacity = interpolate(
      outroSplashOpacity.get(),
      [0, 0.1, 0.2, 1],
      [1, 1, 0, 0],
      'clamp',
    )

    return {
      opacity: introOpacity * outroOpacity,
      transform: [
        {translateY: -(insets.top / 2)},
        {scale: 0.1 * outroScale * introScale},
      ],
    }
  })
  const bottomLogoAnimation = useAnimatedStyle(() => {
    return {
      opacity: interpolate(intro.get(), [0, 1], [0, 1], 'clamp'),
    }
  })

  const splashAnimation = useAnimatedStyle(() => {
    return {
      opacity: interpolate(
        outroSplashOpacity.get(),
        [0, 0.1, 0.2, 1],
        [1, 1, 0, 0],
        'clamp',
      ),
    }
  })

  /**
   * Keep the app opaque so iOS blur/glass effects can initialize while the
   * splash hides it.
   */
  const appAnimation = useAnimatedStyle(() => {
    return {
      transform: [
        {
          scale: interpolate(outroApp.get(), [0, 1], [1.1, 1], 'clamp'),
        },
      ],
    }
  })

  const onFinish = useCallback(() => setIsAnimationComplete(true), [])
  const onLayout = useCallback(() => setIsLayoutReady(true), [])
  const onLoadEnd = useCallback(() => setIsImageLoaded(true), [])

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync()
        .then(() => {
          intro.set(
            withTiming(
              1,
              {duration: 400, easing: Easing.out(Easing.cubic)},
              () => {
                'worklet'
                // set these values to check animation at specific point
                outroLogo.set(
                  withTiming(
                    1,
                    {duration: 1200, easing: Easing.in(Easing.cubic)},
                    () => {
                      scheduleOnRN(onFinish)
                    },
                  ),
                )
                outroApp.set(
                  withTiming(1, {
                    duration: 1200,
                    easing: Easing.inOut(Easing.cubic),
                  }),
                )
                outroSplashOpacity.set(
                  withTiming(1, {
                    duration: 1200,
                    easing: Easing.in(Easing.cubic),
                  }),
                )
              },
            ),
          )
        })
        .catch(() => {})
    }
  }, [onFinish, intro, outroLogo, outroApp, outroSplashOpacity, isReady])

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion)
  }, [])

  // special off-spec color for dark mode
  const logoBg = isDarkMode ? '#0F1824' : '#fff'

  return (
    <View style={{flex: 1}} onLayout={onLayout}>
      {isReady && (
        <Animated.View style={[{flex: 1}, appAnimation]}>
          {props.children}
        </Animated.View>
      )}

      {!isAnimationComplete && (
        <Animated.View
          style={[
            a.absolute,
            a.inset_0,
            // The splash PNGs contain partially transparent pixels.
            {backgroundColor: isDarkMode ? '#002861' : '#006AFF'},
            splashAnimation,
          ]}>
          <Image
            accessibilityIgnoresInvertColors
            onLoadEnd={onLoadEnd}
            source={{uri: isDarkMode ? darkSplashImageUri : splashImageUri}}
            style={[a.absolute, a.inset_0]}
          />

          <Animated.View
            style={[
              bottomLogoAnimation,
              {
                position: 'absolute',
                bottom: insets.bottom + 40,
                left: 0,
                right: 0,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
              },
            ]}>
            <Logotype fill="#fff" width={90} />
          </Animated.View>
        </Animated.View>
      )}

      {isReady && !isAnimationComplete && (
        <Animated.View
          style={[
            a.absolute,
            a.inset_0,
            logoAnimation,
            {
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            },
          ]}>
          <Logo fill={logoBg} />
        </Animated.View>
      )}
    </View>
  )
}
