import {RequireCapability} from '@/auth/capabilities'
import {EditProfileScreen} from '@/features/profile/screens/EditProfileScreen'

export default function EditProfileRoute() {
  return (
    <RequireCapability capability="profile:manage" message="Sign in to edit your profile.">
      <EditProfileScreen />
    </RequireCapability>
  )
}
