import {
  BigNumber,
  DEST_ID,
  fromBase58Check,
  TransferDestination,
  VerusPayInvoice,
  VerusPayInvoiceDetails,
} from 'verus-typescript-primitives'
import {type VerusIdInterface} from 'verusid-ts-client'

import {LOCAL_DEV_VSKY_SERVER} from '#/lib/constants'
import {VERUSSKY_CONFIG} from '#/env/verussky'

const AMOUNT_TO_SATS = 100000000 // 10^8
const MAX_ESTIMATED_SLIPPAGE = new BigNumber(0.05 * AMOUNT_TO_SATS, 10)

async function createVerusPayInvoice(
  idInterface: VerusIdInterface,
  destinationId: string,
  currencyId: string,
  amount?: number,
): Promise<VerusPayInvoice> {
  const details = new VerusPayInvoiceDetails({
    amount: amount ? new BigNumber(amount * AMOUNT_TO_SATS, 10) : undefined,
    destination: new TransferDestination({
      type: DEST_ID,
      destination_bytes: fromBase58Check(destinationId).hash,
    }),
    requestedcurrencyid: currencyId,
    maxestimatedslippage: MAX_ESTIMATED_SLIPPAGE,
  })

  details.setFlags({
    acceptsAnyAmount: !amount,
    // Conversions aren't allowed for unknown amounts.
    acceptsConversion: !!amount,
    isTestnet: !VERUSSKY_CONFIG.isMainnet,
  })

  const inv = await idInterface.createVerusPayInvoice(details)
  return inv
}

async function signVerusPayInvoice(
  invoice: VerusPayInvoice,
): Promise<VerusPayInvoice> {
  const response = await fetch(
    `${LOCAL_DEV_VSKY_SERVER}/api/v1/invoices/sign`,
    {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(invoice.toJson()),
    },
  )

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to sign invoice')
  }

  const data = await response.json()
  return VerusPayInvoice.fromJson(data)
}

export async function createAndSignVerusPayInvoice(
  idInterface: VerusIdInterface,
  destinationId: string,
  currency: string,
  amount?: number,
) {
  const invoice = await createVerusPayInvoice(
    idInterface,
    destinationId,
    currency,
    amount,
  )
  return await signVerusPayInvoice(invoice)
}
