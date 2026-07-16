import {RequireCapability} from '@/auth/capabilities'
import {CustomizeProfileScreen} from '@/features/profile/screens/CustomizeProfileScreen'

export default function CustomizeProfileRoute() {
  return (
    <RequireCapability capability="profile:customize" message="Sign in to customize your profile.">
      <CustomizeProfileScreen />
    </RequireCapability>
  )
}
