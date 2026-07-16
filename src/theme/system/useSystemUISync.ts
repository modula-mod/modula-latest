import {useEffect} from 'react'

import type {ResolvedAppearance} from '@/theme/contracts'
import {syncSystemUI} from '@/theme/system/syncSystemUI'

export function useSystemUISync(resolved: ResolvedAppearance): void {
  useEffect(() => {
    void syncSystemUI(resolved)
  }, [resolved])
}
