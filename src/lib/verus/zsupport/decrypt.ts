import {
  DataDescriptor,
  DataDescriptorKey,
  VdxfUniValue,
} from 'verus-typescript-primitives'

import {getVerusCrypto} from './crypto'

// The daemon's signdata puts the data into a CDataDescriptor then wraps it
// in a CVDXF_Data before encrypting. The daemon's decryptdata decrypts and unravels
// the envelope for us, but since the extension only does the decryption we need
// to do the unravelling ourselves.
export async function decryptDataFromDaemonSignData(
  descriptor: DataDescriptor,
  ivk: Buffer,
): Promise<Buffer> {
  const verusCrypto = await getVerusCrypto()

  const decrypted = verusCrypto.decryptData({
    data_to_decrypt: descriptor.objectdata,
    ivk: ivk,
    epk: descriptor.hasEPK() ? descriptor.epk : undefined,
    ssk: descriptor.hasSSK() ? descriptor.ssk : undefined,
  })

  const decryptedUniValue = new VdxfUniValue()
  decryptedUniValue.fromBuffer(Buffer.from(decrypted))

  const wrappedDescriptor = decryptedUniValue.values
    .map(value => value[DataDescriptorKey.vdxfid])
    .find((d): d is DataDescriptor => d instanceof DataDescriptor)

  if (!wrappedDescriptor) {
    throw new Error('Missing data descriptor in decrypted data')
  }

  return wrappedDescriptor.objectdata
}
