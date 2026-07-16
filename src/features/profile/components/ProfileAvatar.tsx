import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {Avatar} from '@/components/primitives/Avatar'
import type {ModulaProfile} from '@/features/profile/contracts/profile'
import {FocusHalo} from '@/features/profile/components/FocusHalo'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileAvatarProps = {
  profile: ModulaProfile
  size: number
  showFocusHalo: boolean
  style?: StyleProp<ViewStyle>
}

export function ProfileAvatar({
  profile,
  size,
  showFocusHalo,
  style,
}: ProfileAvatarProps) {
  const {colours} = useThemeTokens()

  return (
    <FocusHalo
      status={profile.focusStatus}
      profileName={profile.displayName}
      size={size}
      visible={showFocusHalo}>
      <Avatar
        name={profile.displayName}
        uri={profile.avatarUri}
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
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'hidden',
  },
})
