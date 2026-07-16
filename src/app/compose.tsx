import {RequireCapability} from '@/auth/capabilities'
import {ComposerScreen} from '@/features/composer/screens/ComposerScreen'

export default function ComposeRoute() {
  return (
    <RequireCapability capability="post:create" message="Sign in to publish a post.">
      <ComposerScreen />
    </RequireCapability>
  )
}
