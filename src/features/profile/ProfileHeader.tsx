import {View} from 'react-native'

import {AppAvatar} from '@/components/primitives/AppAvatar'
import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

type ProfileHeaderProps = {
  displayName: string
  handle: string
  bio?: string
  onEditPress?: () => void
  editLabel?: string
}

export function ProfileHeader({
  displayName,
  handle,
  bio,
  onEditPress,
  editLabel = 'Edit profile',
}: ProfileHeaderProps) {
  const {spacing} = useTheme()

  return (
    <View style={{alignItems: 'center', gap: spacing.md, marginBottom: spacing.xl}}>
      <AppAvatar name={displayName} size={88} />
      <AppText variant="title">{displayName}</AppText>
      <AppText colour="textSecondary">@{handle}</AppText>
      {bio ? <AppText style={{textAlign: 'center'}}>{bio}</AppText> : null}
      {onEditPress ? (
        <AppButton variant="secondary" onPress={onEditPress}>
          {editLabel}
        </AppButton>
      ) : null}
    </View>
  )
}
