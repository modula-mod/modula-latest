import {StyleSheet, View} from 'react-native'

import {SkeletonBlock, SkeletonRow} from '@/platform/ui/skeletons/SkeletonBlock'
import {profileGeometry, PROFILE_LAYOUT} from '@/features/profile/model/profile-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Mirrors the loaded hero: avatar in the cradle, identity on the plateau. */
export function ProfileHeroSkeleton() {
  const {spacing} = useThemeTokens()
  const geometry = profileGeometry(true, false, spacing[4])
  const avatar = geometry.avatarSize

  return (
    <View>
      <SkeletonBlock
        height={PROFILE_LAYOUT.coverBodyCompact}
        width="100%"
        borderRadius={0}
      />
      <View
        style={[
          styles.body,
          {
            marginTop: -geometry.raisedBodyHeight,
            paddingHorizontal: spacing[4],
          },
        ]}>
        <View style={styles.row}>
          <View
            style={[
              styles.metrics,
              {gap: spacing[2], paddingTop: geometry.metricColumnTop, width: geometry.identityColumnOffset},
            ]}>
            <SkeletonBlock height={22} width={56} />
            <SkeletonBlock height={22} width={72} />
            <SkeletonBlock height={22} width={64} />
          </View>
          <View style={[styles.identity, {gap: spacing[2], paddingTop: geometry.plateauRadius}]}>
            <SkeletonBlock height={24} width="52%" />
            <SkeletonBlock height={14} width="70%" />
            <SkeletonBlock height={14} width="94%" />
            <SkeletonBlock height={14} width="78%" />
            <SkeletonRow gap={spacing[4]}>
              <SkeletonBlock height={12} width={72} />
              <SkeletonBlock height={12} width={88} />
            </SkeletonRow>
          </View>
        </View>
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.avatar,
          {
            height: avatar,
            width: avatar,
            left: geometry.heroHorizontalInset,
            top: PROFILE_LAYOUT.coverBodyCompact - geometry.avatarLift,
          },
        ]}>
        <SkeletonBlock height={avatar} width={avatar} borderRadius={avatar / 2} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    position: 'absolute',
  },
  body: {
    width: '100%',
  },
  identity: {
    flex: 1,
    minWidth: 0,
  },
  metrics: {
    alignItems: 'flex-start',
    flexGrow: 0,
    flexShrink: 0,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    minWidth: 0,
  },
})
