import {useContext} from 'react'

import {ProfileActionsContext} from '@/features/profile/runtime/ProfileActionsContext'

export function useProfileActions() {
  const context = useContext(ProfileActionsContext)
  if (!context) {
    throw new Error('useProfileActions must be used within ProfilePresentationProvider')
  }
  return context
}
