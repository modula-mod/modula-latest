import {useRouter, type Href} from 'expo-router'

import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {shareProfile} from '@/features/profile/services/shareProfile'
import {ModulaActionButton} from '@/platform/ui/buttons/modula-action-button'
import {ModulaIconButton} from '@/platform/ui/buttons/modula-icon-button'
import {ModulaToolbar} from '@/platform/ui/toolbars'

type ProfileOwnerToolbarProps = {
  profile: ModulaProfile
}

export function ProfileOwnerToolbar({profile}: ProfileOwnerToolbarProps) {
  const router = useRouter()
  return (
    <ModulaToolbar variant="content">
      <ModulaActionButton
        icon="profile"
        label="Edit profile"
        onPress={() => router.push('/profile/edit' as Href)}
      />
      <ModulaActionButton
        icon="appearance"
        label="Customize"
        onPress={() => router.push('/profile/customize' as Href)}
      />
      <ModulaIconButton
        accessibilityLabel="Preview profile link"
        icon="share"
        onPress={() => void shareProfile(profile)}
      />
    </ModulaToolbar>
  )
}
