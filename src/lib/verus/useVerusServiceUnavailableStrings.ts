import {msg} from '@lingui/core/macro'
import {useLingui} from '@lingui/react'

export function useVerusServiceUnavailableMessage() {
  const {_} = useLingui()
  return _(
    msg`Unable to contact the Verus Service. Please check your Verus Services settings and try again.`,
  )
}
