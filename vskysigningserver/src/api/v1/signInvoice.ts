import {toIAddress, type VerusPayInvoice} from 'verus-typescript-primitives'
import {VerusIdInterface} from 'verusid-ts-client'

import {CHAIN, REMOTE_RPC_URL, signingAddress} from '../../config'
import {fetchWIF} from '../../utils/signing'

const idInterface = new VerusIdInterface(CHAIN, REMOTE_RPC_URL)

export const signInvoice = async (
  invoice: VerusPayInvoice,
): Promise<VerusPayInvoice> => {
  console.log('Signing invoice at', new Date().toLocaleTimeString())

  try {
    const wif = await fetchWIF(signingAddress)
    const signed = await idInterface.signVerusPayInvoice(
      invoice,
      signingAddress,
      toIAddress(CHAIN),
      wif,
    )
    return signed
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    throw new Error(`Failed to sign invoice: ${error.message}`)
  }
}
