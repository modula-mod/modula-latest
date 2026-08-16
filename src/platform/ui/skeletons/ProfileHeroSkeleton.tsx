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
        <View style={styles.heroRow}>
          <SkeletonBlock
            height={avatar}
            width={avatar}
            borderRadius={avatar / 2}
            style={styles.avatar}
          />
          <View style={[styles.identity, {gap: spacing[2]}]}>
            <SkeletonBlock height={22} width="58%" />
            <SkeletonBlock height={14} width="44%" />
          </View>
        </View>
        <View style={styles.lower}>
          <View style={styles.metrics}>
            <SkeletonBlock height={16} width={48} />
            <SkeletonBlock height={24} width={64} />
            <SkeletonBlock height={16} width={56} />
          </View>
          <View style={[styles.info, {gap: spacing[2]}]}>
            <SkeletonBlock height={14} width="90%" />
            <SkeletonBlock height={14} width="70%" />
            <SkeletonRow gap={spacing[4]}>
              <SkeletonBlock height={12} width={72} />
              <SkeletonBlock height={12} width={88} />
            </SkeletonRow>
          </View>
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    marginTop: -36,
  },
  body: {
    width: '100%',
  },
  heroRow: {
    flexDirection: 'row',
    minWidth: 0,
  },
  identity: {
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 0,
    paddingLeft: 12,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  lower: {
    flexDirection: 'row',
    minWidth: 0,
  },
  metrics: {
    alignItems: 'center',
    gap: 6,
    paddingRight: 12,
    width: 96,
  },
})
