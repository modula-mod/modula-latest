import {Pressable, StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {Avatar} from '@/components/primitives/Avatar'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {FocusHalo} from '@/features/profile/components/FocusHalo'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileAvatarProps = {
  profile: ModulaProfile
  size: number
  showFocusHalo: boolean
  style?: StyleProp<ViewStyle>
  canEdit?: boolean
  onEditPress?: () => void
  previewUri?: string | null
}

export function ProfileAvatar({
  profile,
  size,
  showFocusHalo,
  style,
  canEdit,
  onEditPress,
  previewUri,
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

  if (!canEdit || !onEditPress) {
    return avatar
  }

  return (
    <Pressable
      accessibilityLabel="Change profile photo"
      accessibilityRole="button"
      onPress={onEditPress}>
      {avatar}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
  },
})
