import {StyleSheet, View} from 'react-native'

import {SkeletonBlock, SkeletonRow} from '@/platform/ui/skeletons/SkeletonBlock'
import {PROFILE_LAYOUT} from '@/features/profile/model/profile-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProfileHeroSkeleton() {
  const {spacing} = useThemeTokens()
  const avatar = PROFILE_LAYOUT.avatarCompact

  return (
    <View>
      <SkeletonBlock height={PROFILE_LAYOUT.coverBodyCompact + 48} width="100%" borderRadius={0} />
      <View style={[styles.body, {gap: spacing[3], paddingHorizontal: spacing[4]}]}>
        <SkeletonBlock
          height={avatar}
          width={avatar}
          borderRadius={avatar / 2}
          style={styles.avatar}
        />
        <View style={styles.actions} />
        <SkeletonBlock height={22} width="48%" />
        <SkeletonBlock height={14} width="36%" />
        <SkeletonBlock height={14} width="90%" />
        <View style={styles.metrics}>
          <SkeletonBlock height={18} width={56} />
          <SkeletonBlock height={28} width={88} />
          <SkeletonBlock height={18} width={56} />
        </View>
        <SkeletonRow gap={spacing[4]}>
          <SkeletonBlock height={14} width={52} />
          <SkeletonBlock height={14} width={52} />
          <SkeletonBlock height={14} width={52} />
          <SkeletonBlock height={14} width={64} />
        </SkeletonRow>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  actions: {
    height: 44,
  },
  avatar: {
    marginTop: -40,
  },
  body: {
    width: '100%',
  },
  metrics: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
})
