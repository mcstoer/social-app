import {msg, Trans} from '@lingui/macro'
import {useLingui} from '@lingui/react'
import {type NativeStackScreenProps} from '@react-navigation/native-stack'
import {PROOFS_CONTROLLER_BLUESKY} from 'verus-typescript-primitives'

import {type CommonNavigatorParams} from '#/lib/routes/types'
import {useVerusService} from '#/state/preferences'
import {useLinkedVerusIDQuery} from '#/state/queries/verus/useLinkedVerusIdQuery'
import {useSession} from '#/state/session'
import * as SettingsList from '#/screens/Settings/components/SettingsList'
import {atoms as a, useTheme} from '#/alf'
import {useDialogControl} from '#/components/Dialog'
import {useRemoveVerusIdAccountLinkDialogControl} from '#/components/dialogs/RemoveVerusIDAccountLinkDialog'
import {useVerusIdAccountLinkingDialogControl} from '#/components/dialogs/VerusIDAccountLinkingDialog'
import {VerusServiceDialog} from '#/components/dialogs/VerusServiceDialog'
import {At_Stroke2_Corner2_Rounded as AtIcon} from '#/components/icons/At'
import {ChainLink_Stroke2_Corner0_Rounded as ChainLinkIcon} from '#/components/icons/ChainLink'
import {CircleX_Stroke2_Corner0_Rounded as CircleXIcon} from '#/components/icons/CircleX'
import {Earth_Stroke2_Corner2_Rounded as EarthIcon} from '#/components/icons/Globe'
import {Verified_Stroke2_Corner2_Rounded} from '#/components/icons/Verified'
import * as Layout from '#/components/Layout'

type Props = NativeStackScreenProps<
  CommonNavigatorParams,
  'VerusServicesSettings'
>
export function VerusServicesSettingsScreen({}: Props) {
  const t = useTheme()
  const {_} = useLingui()
  const {currentAccount} = useSession()
  const {verusIdInterface} = useVerusService()
  const verusIdAccountLinkingControl = useVerusIdAccountLinkingDialogControl()
  const removeVerusIdAccountLinkControl =
    useRemoveVerusIdAccountLinkDialogControl()
  const verusServiceDialogControl = useDialogControl()

  const linkIdentifier = PROOFS_CONTROLLER_BLUESKY.vdxfid
  const {data: linkedVerusID} = useLinkedVerusIDQuery(
    linkIdentifier,
    currentAccount?.did,
    verusIdInterface,
  )

  return (
    <Layout.Screen>
      <Layout.Header.Outer>
        <Layout.Header.BackButton />
        <Layout.Header.Content>
          <Layout.Header.TitleText>
            <Trans>Verus Services</Trans>
          </Layout.Header.TitleText>
        </Layout.Header.Content>
        <Layout.Header.Slot />
      </Layout.Header.Outer>
      <Layout.Content>
        <SettingsList.Container>
          <SettingsList.Item>
            <SettingsList.ItemIcon icon={AtIcon} />
            {/* Uses the same flexbox solution as the Account Settings. TODO: Update when the solution is found for it.*/}
            <SettingsList.ItemText style={[a.flex_0]}>
              <Trans>Linked VerusID</Trans>
            </SettingsList.ItemText>
            <SettingsList.BadgeText style={[a.flex_1]}>
              {linkedVerusID ? (
                linkedVerusID.identity
              ) : (
                <Trans>(no identity)</Trans>
              )}
            </SettingsList.BadgeText>
            {linkedVerusID &&
              currentAccount?.type === 'vsky' &&
              linkedVerusID.identity === currentAccount.name + '@' && (
                <Verified_Stroke2_Corner2_Rounded
                  fill={t.palette.primary_500}
                  size="md"
                />
              )}
          </SettingsList.Item>
          <SettingsList.Divider />
          <SettingsList.PressableItem
            label={_(msg`Link Account to VerusID`)}
            onPress={() => verusIdAccountLinkingControl.open({})}>
            <SettingsList.ItemIcon icon={ChainLinkIcon} />
            <SettingsList.ItemText>
              {linkedVerusID ? (
                <Trans>Update VerusID Link</Trans>
              ) : (
                <Trans>Link Account to VerusID</Trans>
              )}
            </SettingsList.ItemText>
            <SettingsList.Chevron />
          </SettingsList.PressableItem>
          {linkedVerusID && (
            <SettingsList.PressableItem
              label={_(msg`Remove VerusID Link`)}
              onPress={() => removeVerusIdAccountLinkControl.open()}
              destructive>
              <SettingsList.ItemIcon icon={CircleXIcon} />
              <SettingsList.ItemText>
                <Trans>Remove VerusID Link</Trans>
              </SettingsList.ItemText>
              <SettingsList.Chevron />
            </SettingsList.PressableItem>
          )}
          <SettingsList.Divider />
          <SettingsList.PressableItem
            label={_(msg`Verus Services Endpoint (Advanced)`)}
            onPress={() => verusServiceDialogControl.open()}>
            <SettingsList.ItemIcon icon={EarthIcon} />
            <SettingsList.ItemText>
              <Trans>Verus Services Endpoint (Advanced)</Trans>
            </SettingsList.ItemText>
            <SettingsList.Chevron />
          </SettingsList.PressableItem>
        </SettingsList.Container>
      </Layout.Content>

      <VerusServiceDialog control={verusServiceDialogControl} />
    </Layout.Screen>
  )
}
