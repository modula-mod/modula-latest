import {StyleSheet, View} from 'react-native'

import {SkeletonBlock, SkeletonRow} from '@/platform/ui/skeletons/SkeletonBlock'
import {profileCoverBody, profileGeometry} from '@/features/profile/model/profile-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Mirrors the loaded hero: portrait in the plateau row, identity beside it. */
export function ProfileHeroSkeleton() {
  const {spacing} = useThemeTokens()
  const geometry = profileGeometry(true, false, spacing[4])
  const avatar = geometry.avatarSize
  const cover = profileCoverBody(true)

  return (
    <View>
      <View style={styles.cover}>
        <SkeletonBlock height={cover} width="100%" borderRadius={0} />
      </View>
      <View
        style={[
          styles.body,
          {
            marginTop: -geometry.plateauDepth,
            paddingHorizontal: spacing[4],
            paddingTop: geometry.identityPlateauGap,
          },
        ]}>
        <View style={styles.row}>
          <View
            style={[
              styles.metrics,
              {
                gap: geometry.metricColumnTop,
                width: geometry.metricColumnWidth,
              },
            ]}>
            <View
              style={[
                styles.avatar,
                {
                  height: avatar,
                  width: avatar,
                  marginTop: geometry.avatarFlowTop,
                  marginLeft: geometry.avatarFlowLeft,
                },
              ]}>
              <SkeletonBlock height={avatar} width={avatar} borderRadius={avatar / 2} />
            </View>
            <SkeletonBlock height={22} width={56} />
            <SkeletonBlock height={22} width={72} />
            <SkeletonBlock height={22} width={64} />
          </View>
          <View
            style={[
              styles.identity,
              {
                gap: spacing[2],
                paddingLeft: geometry.identityColumnPad,
                paddingTop: geometry.identityPlateauGap + geometry.identityDrop,
              },
            ]}>
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
    </View>
  )
}

const styles = StyleSheet.create({
  avatar: {
    overflow: 'visible',
  },
  body: {
    overflow: 'visible',
    width: '100%',
  },
  cover: {
    overflow: 'visible',
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
