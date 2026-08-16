import {Pressable, StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {Avatar} from '@/components/primitives/Avatar'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {FocusHalo} from '@/features/profile/components/FocusHalo'
import {
  applyProfilePhotoMenuAction,
  profilePhotoMenuActions,
} from '@/features/profile/components/profile-photo-menu'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileAvatarProps = {
  profile: ModulaProfile
  size: number
  showFocusHalo: boolean
  style?: StyleProp<ViewStyle>
  canEdit?: boolean
  onEditPress?: () => void
  previewUri?: string | null
  onPhotoUri?: (uri: string) => void
  onPhotoRemove?: () => void
}

export function ProfileAvatar({
  profile,
  size,
  showFocusHalo,
  style,
  canEdit,
  onEditPress,
  previewUri,
  onPhotoUri,
  onPhotoRemove,
}: ProfileAvatarProps) {
  const {colours} = useThemeTokens()
  const uri = previewUri === undefined ? profile.avatarUri : previewUri ?? undefined

  const avatar = (
    <FocusHalo
      status={profile.focusStatus}
      profileName={profile.displayName}
      size={size}
      visible={showFocusHalo}>
      <Avatar
        name={profile.displayName}
        uri={uri}
        colour={profile.coverColour}
        size={size}
        style={[
          styles.avatar,
          {
            borderColor: colours.canvas,
            borderWidth: 4,
          },
          style,
        ]}
      />
    </FocusHalo>
  )

  if (!canEdit) {
    return avatar
  }

  const trigger = onEditPress ? (
    <Pressable
      accessibilityLabel="Change profile photo"
      accessibilityRole="button"
      onPress={onEditPress}>
      {avatar}
    </Pressable>
  ) : (
    avatar
  )

  if (!onPhotoUri || !onPhotoRemove) {
    return trigger
  }

  const applyUri = onPhotoUri
  const applyRemove = onPhotoRemove

  return (
    <ModulaContextMenu
      fit="content"
      accessibilityLabel="Profile photo actions"
      title="Profile photo"
      actions={profilePhotoMenuActions({
        hasPhoto: Boolean(uri),
        removeLabel: 'Remove profile picture',
      })}
      onAction={id => {
        void applyProfilePhotoMenuAction({
          actionId: id,
          target: 'avatar',
          onUri: applyUri,
          onRemove: applyRemove,
        })
      }}>
      {trigger}
    </ModulaContextMenu>
  )
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
  },
})
