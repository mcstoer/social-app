import {View} from 'react-native'
import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'

import {type VerusIdLink} from '#/lib/verus/accountLinking'
import {atoms as a, useBreakpoints, useTheme} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as ProfileCard from '#/components/ProfileCard'
import {Text} from '#/components/Typography'

export {useDialogControl} from '#/components/Dialog'

export function VerusIdVerificationsDialog({
  control,
  verusIdLink,
}: {
  control: Dialog.DialogControlProps
  verusIdLink: VerusIdLink
}) {
  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Inner control={control} verusIdLink={verusIdLink} />
    </Dialog.Outer>
  )
}

function Inner({
  control,
  verusIdLink,
}: {
  control: Dialog.DialogControlProps
  verusIdLink: VerusIdLink
}) {
  const t = useTheme()
  const {_} = useLingui()
  const {gtMobile} = useBreakpoints()

  return (
    <Dialog.ScrollableInner
      label={_(msg`VerusID`)}
      style={[
        gtMobile ? {width: 'auto', maxWidth: 400, minWidth: 200} : a.w_full,
      ]}>
      <View style={[a.gap_sm, a.pb_lg]}>
        <Text style={[a.text_2xl, a.font_semi_bold, a.pr_4xl, a.leading_tight]}>
          <Trans>VerusID</Trans>
        </Text>
        <Text style={[a.text_md, a.leading_snug]}>
          <Trans>
            This account is linked to VerusID, a decentralized identity system.
          </Trans>
        </Text>
      </View>

      <View style={[a.pb_xl, a.gap_md]}>
        <Text style={[a.text_sm, t.atoms.text_contrast_medium]}>
          <Trans>Identity:</Trans>
        </Text>

        <View style={[a.gap_lg]}>
          <VerusIdCard identity={verusIdLink.identity} />
        </View>
      </View>

      <View
        style={[
          a.w_full,
          a.gap_sm,
          a.justify_end,
          gtMobile
            ? [a.flex_row, a.flex_row_reverse, a.justify_start]
            : [a.flex_col],
        ]}>
        <Button
          label={_(msg`Close dialog`)}
          size="small"
          variant="solid"
          color="primary"
          onPress={() => {
            control.close()
          }}>
          <ButtonText>
            <Trans>Close</Trans>
          </ButtonText>
        </Button>
      </View>

      <Dialog.Close />
    </Dialog.ScrollableInner>
  )
}

function VerusIdCard({identity}: {identity: string}) {
  const t = useTheme()

  return (
    <ProfileCard.Outer>
      <ProfileCard.Header>
        <View
          style={[
            a.rounded_full,
            a.align_center,
            a.justify_center,
            {
              width: 42,
              height: 42,
              backgroundColor: t.palette.primary_500,
            },
          ]}>
          {/*Placeholder for the actual VerusID logo, or potentially logo for the identity*/}
          <Text style={[a.text_xl, a.font_bold, {color: t.palette.white}]}>
            V
          </Text>
        </View>
        <View style={[a.flex_1]}>
          <Text
            style={[a.text_md, a.font_semi_bold, a.leading_snug]}
            numberOfLines={1}>
            {identity}
          </Text>
          <Text
            emoji
            style={[a.leading_snug, t.atoms.text_contrast_medium]}
            numberOfLines={1}>
            {/*Possibly put the system here*/}
            <Trans>VerusID</Trans>
          </Text>
        </View>
      </ProfileCard.Header>
    </ProfileCard.Outer>
  )
}
