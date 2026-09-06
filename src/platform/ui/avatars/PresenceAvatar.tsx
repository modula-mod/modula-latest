import {ModulaAvatar} from '@/platform/ui/avatars/modula-avatar'
import type {PresenceStatus} from '@/platform/ui/avatars/types'

type PresenceAvatarProps = {
  name: string
  uri?: string
  colour?: string
  size?: number
  status?: PresenceStatus
}

/**
 * Avatar with a presence ring/dot. Extension point for Messages / share contacts.
 */
export function PresenceAvatar({
  name,
  uri,
  colour,
  size = 40,
  status = 'offline',
}: PresenceAvatarProps) {
  return <ModulaAvatar colour={colour} name={name} presence={status} size={size} uri={uri} />
}
