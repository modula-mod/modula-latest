import type {ProfileScreenMode} from '@/features/profile/contracts/profile'
import {ProfileShell} from '@/features/profile/components/ProfileShell'

type UnifiedProfileScreenProps = {
  mode: ProfileScreenMode
  handle?: string
}

export function UnifiedProfileScreen({mode, handle}: UnifiedProfileScreenProps) {
  return <ProfileShell mode={mode} handle={handle} />
}
