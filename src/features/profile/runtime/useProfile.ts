import {useContext} from 'react'

import {ProfileStateContext} from '@/features/profile/runtime/ProfileStateContext'

export function useProfile() {
  const context = useContext(ProfileStateContext)
  if (!context) {
    throw new Error('useProfile must be used within ProfilePresentationProvider')
  }
  return context
}
