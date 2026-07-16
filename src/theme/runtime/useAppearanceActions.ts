import {useContext} from 'react'

import {AppearanceActionsContext} from '@/theme/runtime/AppearanceActionsContext'

export function useAppearanceActions() {
  const context = useContext(AppearanceActionsContext)
  if (!context) {
    throw new Error('useAppearanceActions must be used within AppearanceProvider')
  }
  return context
}
