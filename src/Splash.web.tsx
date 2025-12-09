/*
 * This is a reimplementation of what exists in our HTML template files
 * already. Once the React tree mounts, this is what gets rendered first, until
 * the app is ready to go.
 */

import {View} from 'react-native'
import Svg, {Path} from 'react-native-svg'

import {atoms as a} from '#/alf'

const size = 100

export function Splash() {
  return (
    <View style={[a.fixed, a.inset_0, a.align_center, a.justify_center]}>
      <Svg
        fill="none"
        viewBox="0 0 201 201"
        style={[a.relative, {width: size, height: size, top: -50}]}>
        <Path
          fill="#fff"
          d="M100.5 201c55.505 0 100.5-44.995 100.5-100.5S156.005 0 100.5 0 0 44.995 0 100.5 44.995 201 100.5 201Z"
        />
        <Path
          fill="#3165D4"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M100.5 0C155.968 0 201 45.032 201 100.5c0 55.467-45.033 100.5-100.5 100.5S0 155.968 0 100.5C0 45.033 45.033 0 100.5 0ZM51.228 36.353c3.795-3.25 9.12-5.92 13.75-4.04 8.324 3.38 30.69 48.472 30.69 48.472s31.285-44.445 42.521-48.499c3.833-1.382 9.089 1.05 13.097 4.046 14.067 10.517 15.52 25.19 14.304 29.26-1.528 5.118-79.238 103.717-79.238 103.717-2.324-.948-48.367-86.406-50.863-101.029-2.384-13.974 5.729-23.468 15.739-31.927v0Z"
        />
      </Svg>
    </View>
  )
}
