import {useContext} from 'react'

import {AppearanceStateContext} from '@/theme/runtime/AppearanceStateContext'

export function useAppearance() {
  const context = useContext(AppearanceStateContext)
  if (!context) {
    throw new Error('useAppearance must be used within AppearanceProvider')
  }
  return context
}
