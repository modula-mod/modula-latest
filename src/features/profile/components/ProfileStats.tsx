import {StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {
  ModulaProfile,
  ProfilePresentationPreferences,
} from '@/features/profile/contracts/profile'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type ProfileStatsProps = {
  profile: ModulaProfile
  ownerHandle: string
  presentation: ProfilePresentationPreferences
  onSelectTab: (tabId: string) => void
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(value >= 10000000 ? 0 : 1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`
  return String(value)
}

function formatFull(value: number): string {
  return new Intl.NumberFormat().format(value)
}

export function ProfileStats({
  profile,
  ownerHandle,
  presentation,
  onSelectTab,
}: ProfileStatsProps) {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  const baseRoute = `/profile/${profile.handle}`
  const stats = [
    {
      id: 'posts',
      label: 'Posts',
      value: profile.postCount,
      visible: true,
      onPress: () => onSelectTab('posts'),
    },
    {
      id: 'followers',
      label: 'Followers',
      value: profile.followerCount,
      visible: presentation.showFollowerCount,
      onPress: () => router.push(`${baseRoute}/followers` as Href),
    },
    {
      id: 'following',
      label: 'Following',
      value: profile.followingCount,
      visible: presentation.showFollowerCount,
      onPress: () => router.push(`${baseRoute}/following` as Href),
    },
    {
      id: 'modules',
      label: 'Modules',
      value: profile.moduleCount,
      visible: presentation.showModuleCount,
      onPress: () => onSelectTab('modules'),
    },
  ].filter(item => item.visible)

  return (
    <View
      style={[
        styles.row,
        {borderTopColor: colours.separator, borderBottomColor: colours.separator},
      ]}>
      {stats.map(item => (
        <AppPressable
          key={item.id}
          accessibilityLabel={`${formatFull(item.value)} ${item.label.toLowerCase()}`}
          onPress={item.onPress}
          style={[styles.stat, {gap: spacing[1]}]}>
          <AppText variant="headline" style={styles.center}>
            {formatCompact(item.value)}
          </AppText>
          <AppText variant="caption" colour="textSecondary" style={styles.center}>
            {item.label}
          </AppText>
        </AppPressable>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  center: {
    textAlign: 'center',
  },
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  stat: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 64,
  },
})
