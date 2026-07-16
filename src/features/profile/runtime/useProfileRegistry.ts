import {useContext} from 'react'

import {ProfileRegistryContext} from '@/features/profile/runtime/ProfileRegistryContext'

export function useProfileRegistry() {
  const context = useContext(ProfileRegistryContext)
  if (!context) {
    throw new Error('useProfileRegistry must be used within ProfilePresentationProvider')
  }
  return context
}
