import type {PropsWithChildren} from 'react'

import {KonstaPresentationRoot} from '@/platform/ui/adapters/konsta/konsta-provider.web'
import {useAppearance} from '@/theme/runtime/useAppearance'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function WebPresentationProvider({children}: PropsWithChildren) {
  const {preferences} = useAppearance()
  const tokens = useThemeTokens()
  return (
    <KonstaPresentationRoot
      presentation={preferences.webPresentation}
      tokens={tokens}>
      {children}
    </KonstaPresentationRoot>
  )
}
