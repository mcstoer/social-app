import {useQueryClient} from '@tanstack/react-query'

import {useVerusService} from '#/state/preferences'
import {STALE} from '#/state/queries'

export const createVerusGetCurrencyQueryKey = (currency: string): string[] => [
  'verus-getcurrency',
  currency,
]

export function useGetVerusCurrency() {
  const queryClient = useQueryClient()
  const {verusRpcInterface} = useVerusService()

  return async (currency: string) => {
    return queryClient.fetchQuery({
      queryKey: createVerusGetCurrencyQueryKey(currency),
      staleTime: STALE.MINUTES.FIVE,
      queryFn: () => verusRpcInterface.getCurrency(currency),
    })
  }
}
