import {QueryClientProvider} from '@tanstack/react-query'
import {useEffect, useMemo, type PropsWithChildren} from 'react'

import {NetworkRuntime} from '@/data/network'
import {createQueryClient} from '@/data/query/createQueryClient'
import {installQueryFocusManager} from '@/data/query/queryFocusManager'

export function QueryRuntimeProvider({children}: PropsWithChildren) {
  const queryClient = useMemo(() => createQueryClient(), [])

  useEffect(() => installQueryFocusManager(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <NetworkRuntime>{children}</NetworkRuntime>
    </QueryClientProvider>
  )
}
