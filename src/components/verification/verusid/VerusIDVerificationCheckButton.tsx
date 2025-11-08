import {View} from 'react-native'
import {msg} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {type VerusIdLink} from '#/lib/verus/accountLinking'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button} from '#/components/Button'
import {useDialogControl} from '#/components/Dialog'
import {VerifiedCheck} from '#/components/icons/VerifiedCheck'
import {VerusIdVerificationsDialog} from '#/components/verification/verusid/VerusIdVerificationsDialog'

export function shouldShowVerusIDVerificationCheckButton(link?: VerusIdLink) {
  let ok = false

  if (link && link.identity) {
    ok = true
  }

  return ok
}

export function VerusIDVerificationCheckButton({
  verusIdLink,
  size,
}: {
  verusIdLink: VerusIdLink
  size: 'lg' | 'md' | 'sm'
}) {
  if (shouldShowVerusIDVerificationCheckButton(verusIdLink)) {
    return <VerusIDBadge verusIdLink={verusIdLink} size={size} />
  }

  return null
}

export function VerusIDBadge({
  verusIdLink,
  size,
}: {
  verusIdLink: VerusIdLink
  size: 'lg' | 'md' | 'sm'
}) {
  const t = useTheme()
  const {_} = useLingui()
  const verificationsDialogControl = useDialogControl()
  const {gtPhone} = useBreakpoints()
  let dimensions = 12
  if (size === 'lg') {
    dimensions = gtPhone ? 20 : 18
  } else if (size === 'md') {
    dimensions = 14
  }

  return (
    <>
      <Button
        label={_(msg`View this VerusID verification`)}
        hitSlop={20}
        onPress={evt => {
          evt.preventDefault()
          verificationsDialogControl.open()
        }}>
        {({hovered}) => (
          <View
            style={[
              a.justify_end,
              a.align_end,
              a.transition_transform,
              {
                width: dimensions,
                height: dimensions,
                transform: [
                  {
                    scale: hovered ? 1.1 : 1,
                  },
                ],
              },
            ]}>
            <VerifiedCheck width={dimensions} fill={t.palette.positive_500} />
          </View>
        )}
      </Button>

      <VerusIdVerificationsDialog
        control={verificationsDialogControl}
        verusIdLink={verusIdLink}
      />
    </>
  )
}
