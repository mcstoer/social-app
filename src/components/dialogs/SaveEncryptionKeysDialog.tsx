import {View} from 'react-native'
import {Trans, useLingui} from '@lingui/react/macro'

import {useSessionApi} from '#/state/session'
import {atoms as a, web} from '#/alf'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import {useGlobalDialogsControlContext} from '#/components/dialogs/Context'
import {Text} from '#/components/Typography'

export function useSaveEncryptionKeysDialogControl() {
  return useGlobalDialogsControlContext().saveEncryptionKeysDialogControl
}

export function SaveEncryptionKeysDialog() {
  const {t: l} = useLingui()
  const saveEncryptionKeysControl = useSaveEncryptionKeysDialogControl()
  const passedOnClose = saveEncryptionKeysControl.value?.onClose

  const onClose = () => {
    saveEncryptionKeysControl.clear()
    passedOnClose?.()
  }

  return (
    <Dialog.Outer control={saveEncryptionKeysControl.control} onClose={onClose}>
      <Dialog.Handle />

      <Dialog.ScrollableInner
        label={l`Save Encryption Keys`}
        style={web({maxWidth: 400})}>
        <Inner />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Inner() {
  const {t: l} = useLingui()
  const control = Dialog.useDialogContext()
  const {updateVskyEncryption} = useSessionApi()

  const onChoose = (store: boolean) => {
    updateVskyEncryption({
      storeEncryptionKeys: store,
      hasBeenAskedToStoreKeys: true,
    })
    control.close()
  }

  return (
    <View style={[a.gap_xl]}>
      <View style={[a.gap_sm]}>
        <Text style={[a.font_bold, a.text_2xl]}>
          <Trans>Save Encryption Keys?</Trans>
        </Text>

        <View style={[a.gap_md]}>
          <Text style={[a.text_md, a.leading_snug]}>
            <Trans>
              Saving your keys lets you use VerusSky privacy features right away
              each time you visit.
            </Trans>
          </Text>

          <Text style={[a.text_md, a.leading_snug]}>
            <Trans>
              Only do this on devices you trust. If your keys are stolen, your
              encrypted data is no longer private.
            </Trans>
          </Text>
        </View>
      </View>

      <View style={[a.gap_sm]}>
        <Button
          label={l`Yes`}
          color="primary"
          size="large"
          onPress={() => onChoose(true)}>
          <ButtonText>
            <Trans>Save keys</Trans>
          </ButtonText>
        </Button>
        <Button
          label={l`No`}
          color="secondary"
          size="large"
          onPress={() => onChoose(false)}>
          <ButtonText>
            <Trans>Don't save</Trans>
          </ButtonText>
        </Button>
      </View>
    </View>
  )
}
