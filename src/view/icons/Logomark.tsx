import Svg, {Path, type PathProps, type SvgProps} from 'react-native-svg'

import {usePalette} from '#/lib/hooks/usePalette'

const ratio = 1

export function Logomark({
  fill,
  ...rest
}: {fill?: PathProps['fill']} & SvgProps) {
  const pal = usePalette('default')
  // @ts-ignore it's fiiiiine
  const size = parseInt(rest.width || 32)

  return (
    <Svg
      fill="none"
      viewBox="0 0 201 201"
      {...rest}
      width={size}
      height={Number(size) * ratio}>
      <Path
        fill={fill || pal.text.color}
        fillRule="evenodd"
        clipRule="evenodd"
        d="M100.5 0C155.968 0 201 45.0324 201 100.5C201 155.967 155.967 201 100.5 201C45.0326 201 0 155.968 0 100.5C0 45.0327 45.0326 0 100.5 0ZM51.2278 36.3533C55.0232 33.1034 60.3483 30.4339 64.9778 32.3137C73.3023 35.6939 95.6682 80.7852 95.6682 80.7852C95.6682 80.7852 126.953 36.3395 138.189 32.2864C142.022 30.9038 147.278 33.3358 151.286 36.3322C165.353 46.8492 166.806 61.5218 165.59 65.5923C164.062 70.7098 86.3523 169.309 86.3523 169.309C84.0283 168.361 37.9847 82.9026 35.4895 68.2802C33.105 54.3063 41.2179 44.8116 51.2278 36.3533V36.3533Z"
      />
    </Svg>
  )
}
