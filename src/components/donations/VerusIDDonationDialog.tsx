import {useState} from 'react'
import {View} from 'react-native'
import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'
import {Trans} from '@lingui/react/macro'

import {KNOWN_CURRENCY_IDS} from '#/lib/verus/constants'
import {createAndSignVerusPayInvoice} from '#/lib/verus/requests/createVerusPayInvoice'
import {useVerusService} from '#/state/preferences'
import {useGetVerusCurrency} from '#/state/queries/verus/useVerusGetCurrencyQuery'
import {atoms as a, web} from '#/alf'
import {Admonition} from '#/components/Admonition'
import {Button, ButtonText} from '#/components/Button'
import * as Dialog from '#/components/Dialog'
import * as TextField from '#/components/forms/TextField'
import * as Toggle from '#/components/forms/Toggle'
import {QrCodeInner} from '#/components/StarterPack/QrCode'
import {Text} from '#/components/Typography'

enum Stage {
  Options = 'Options',
  QRCode = 'QRCode',
}

const DONATION_USD = 'usd_1'
const DONATION_EUR = 'eur_1'
const DONATION_CUSTOM = 'custom'

export function VerusIDDonationDialog({
  control,
  identity,
}: {
  control: Dialog.DialogControlProps
  identity: string
}) {
  const {_} = useLingui()

  return (
    <Dialog.Outer control={control}>
      <Dialog.Handle />
      <Dialog.ScrollableInner
        label={_(msg`Donate`)}
        style={web({maxWidth: 400})}>
        <Inner identity={identity} />
        <Dialog.Close />
      </Dialog.ScrollableInner>
    </Dialog.Outer>
  )
}

function Inner({identity}: {identity: string}) {
  const {_} = useLingui()
  const [stage, setStage] = useState(Stage.Options)
  const [deeplinkUri, setDeeplinkUri] = useState('')
  // Lift the state out of the option selection to save it if the user chooses to go back.
  const [selected, setSelected] = useState('')
  const [customCurrency, setCustomCurrency] = useState('')
  const [customAmount, setCustomAmount] = useState('')

  const uiStrings = {
    Options: {
      title: _(msg`Select donation`),
      message: _(
        msg`Choose a preset amount or enter a custom currency to donate.`,
      ),
    },
    QRCode: {
      title: _(msg`Send donation`),
      message: _(
        msg`Scan the QR code with your Verus wallet to send the donation.`,
      ),
    },
  }

  return (
    <View style={[a.gap_xl]}>
      <View style={[a.gap_sm]}>
        <Text style={[a.font_bold, a.text_2xl]}>{uiStrings[stage].title}</Text>
        <Text style={[a.text_md, a.leading_snug]}>
          {uiStrings[stage].message}
        </Text>
      </View>

      {stage === Stage.Options ? (
        <OptionsStage
          identity={identity}
          selected={selected}
          onSelectedChange={setSelected}
          customCurrency={customCurrency}
          onCustomCurrencyChange={setCustomCurrency}
          customAmount={customAmount}
          onCustomAmountChange={setCustomAmount}
          onReady={uri => {
            setDeeplinkUri(uri)
            setStage(Stage.QRCode)
          }}
        />
      ) : (
        <QRCodeStage
          deeplinkUri={deeplinkUri}
          onBack={() => setStage(Stage.Options)}
        />
      )}
    </View>
  )
}

function OptionsStage({
  identity,
  selected,
  onSelectedChange: setSelected,
  customCurrency,
  onCustomCurrencyChange: setCustomCurrency,
  customAmount,
  onCustomAmountChange: setCustomAmount,
  onReady,
}: {
  identity: string
  selected: string
  onSelectedChange: (value: string) => void
  customCurrency: string
  onCustomCurrencyChange: (value: string) => void
  customAmount: string
  onCustomAmountChange: (value: string) => void
  onReady: (deeplinkUri: string) => void
}) {
  const {_} = useLingui()
  const [isChecking, setIsChecking] = useState(false)
  const [error, setError] = useState('')
  const getVerusCurrency = useGetVerusCurrency()
  const {verusIdInterface, verusRpcInterface} = useVerusService()

  const canContinue =
    selected === DONATION_USD ||
    selected === DONATION_EUR ||
    (selected === DONATION_CUSTOM && !!customCurrency && !!customAmount)

  const handleContinue = async () => {
    setError('')
    setIsChecking(true)

    try {
      let currencyId: string
      let amount: number | undefined

      if (selected === DONATION_USD) {
        currencyId = KNOWN_CURRENCY_IDS['vUSDC.vETH']
        amount = 1
      } else if (selected === DONATION_EUR) {
        currencyId = KNOWN_CURRENCY_IDS['EURC.vETH']
        amount = 1
      } else if (
        selected === DONATION_CUSTOM &&
        !!customCurrency &&
        !!customAmount
      ) {
        const parsedAmount = parseFloat(customAmount)
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
          setError(_(msg`Please enter a valid amount`))
          return
        }
        const data = await getVerusCurrency(customCurrency)
        if (!data?.result || data?.error) {
          setError(_(msg`Currency not found`))
          return
        }
        currencyId = data.result.currencyid
        amount = parsedAmount
      } else {
        return
      }

      // TEMP: Resolve the identity name to an i-address
      // This is temporary, as later we should be using getIdentityContent to get the donor settings
      // at the profile level.
      const identityRes = await verusRpcInterface.getIdentity(identity)
      if (!identityRes?.result?.identity?.identityaddress) {
        setError(_(msg`Failed to resolve identity`))
        return
      }
      const destinationId = identityRes.result.identity.identityaddress

      const signedInvoice = await createAndSignVerusPayInvoice(
        verusIdInterface,
        destinationId,
        currencyId,
        amount,
      )

      onReady(signedInvoice.toWalletDeeplinkUri())
    } catch {
      setError(_(msg`Failed to generate invoice`))
    } finally {
      setIsChecking(false)
    }
  }

  return (
    <View style={[a.gap_md]}>
      <Toggle.Group
        label={_(msg`Select donation amount`)}
        type="radio"
        values={[selected]}
        onChange={vals => setSelected(vals[0] ?? '')}>
        <Toggle.PanelGroup>
          <Toggle.Item
            name={DONATION_USD}
            label={_(msg`Donate 1 US Dollar (USDC)`)}>
            {({selected: itemSelected}) => (
              <Toggle.Panel active={itemSelected} adjacent="trailing">
                <Toggle.Radio />
                <Toggle.PanelText>
                  <Trans>$1 USD (USDC)</Trans>
                </Toggle.PanelText>
              </Toggle.Panel>
            )}
          </Toggle.Item>
          <Toggle.Item name={DONATION_EUR} label={_(msg`Donate 1 Euro (EURC)`)}>
            {({selected: itemSelected}) => (
              <Toggle.Panel active={itemSelected} adjacent="both">
                <Toggle.Radio />
                <Toggle.PanelText>
                  <Trans>€1 EUR (EURC)</Trans>
                </Toggle.PanelText>
              </Toggle.Panel>
            )}
          </Toggle.Item>
          <Toggle.Item
            name={DONATION_CUSTOM}
            label={_(msg`Donate a custom currency`)}>
            {({selected: itemSelected}) => (
              <Toggle.Panel active={itemSelected} adjacent="leading">
                <Toggle.Radio />
                <Toggle.PanelText>
                  <Trans>Custom currency and amount</Trans>
                </Toggle.PanelText>
              </Toggle.Panel>
            )}
          </Toggle.Item>
        </Toggle.PanelGroup>
      </Toggle.Group>

      {selected === DONATION_CUSTOM && (
        <View style={[a.gap_md]}>
          <View>
            <TextField.LabelText>
              <Trans>Currency name</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={_(msg`Currency name`)}
                placeholder={_(msg`VRSC`)}
                defaultValue={customCurrency}
                onChangeText={text => {
                  setCustomCurrency(text)
                  setError('')
                }}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField.Root>
          </View>
          <View>
            <TextField.LabelText>
              <Trans>Amount</Trans>
            </TextField.LabelText>
            <TextField.Root>
              <TextField.Input
                label={_(msg`Amount`)}
                placeholder={_(msg`1`)}
                defaultValue={customAmount}
                onChangeText={text => {
                  setCustomAmount(text)
                  setError('')
                }}
                keyboardType="decimal-pad"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </TextField.Root>
          </View>
        </View>
      )}

      {error ? <Admonition type="error">{error}</Admonition> : null}

      <Button
        label={_(msg`Continue`)}
        color="primary"
        size="large"
        disabled={!canContinue || isChecking}
        onPress={handleContinue}>
        <ButtonText>
          {isChecking ? <Trans>Checking...</Trans> : <Trans>Continue</Trans>}
        </ButtonText>
      </Button>
    </View>
  )
}

function QRCodeStage({
  deeplinkUri,
  onBack,
}: {
  deeplinkUri: string
  onBack: () => void
}) {
  const {_} = useLingui()

  return (
    <View style={[a.gap_md]}>
      <View style={[a.align_center, a.py_lg]}>
        <QrCodeInner link={deeplinkUri} useBackupSVG={false} />
      </View>

      <Button
        label={_(msg`Back`)}
        color="secondary"
        size="large"
        onPress={onBack}>
        <ButtonText>
          <Trans>Back</Trans>
        </ButtonText>
      </Button>
    </View>
  )
}
