import {StyleSheet, View} from 'react-native'

import {SkeletonBlock, SkeletonRow} from '@/platform/ui/skeletons/SkeletonBlock'
import {profileCoverBody, profileGeometry} from '@/features/profile/model/profile-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

/** Mirrors the loaded hero: portrait in the pocket, identity, then the pager. */
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
            gap: geometry.metricColumnTop,
          },
        ]}>
        <View style={styles.row}>
          <View
            style={[
              styles.avatarCol,
              {
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
          </View>
          <View
            style={[
              styles.identity,
              {
                gap: spacing[1],
                paddingLeft: geometry.identityColumnPad,
                paddingTop: geometry.identityDrop,
              },
            ]}>
            <SkeletonBlock height={24} width="52%" />
            <SkeletonBlock height={14} width="70%" />
          </View>
        </View>
        <View style={[styles.pager, {minHeight: geometry.pagerHeight, gap: spacing[2]}]}>
          <View style={styles.pagerChrome}>
            <SkeletonBlock height={14} width={96} />
            <SkeletonBlock height={10} width={28} />
          </View>
          <View style={styles.switcher}>
            <SkeletonBlock height={12} width={64} />
            <SkeletonBlock height={12} width={52} />
          </View>
          <View style={styles.metrics}>
            <SkeletonBlock height={22} width="28%" />
            <SkeletonBlock height={10} width="22%" />
            <SkeletonBlock height={28} width="24%" />
            <SkeletonBlock height={10} width="20%" />
            <SkeletonBlock height={22} width="26%" />
          </View>
          <SkeletonRow gap={spacing[2]} style={styles.dots}>
            <SkeletonBlock height={6} width={6} borderRadius={3} />
            <SkeletonBlock height={6} width={6} borderRadius={3} />
          </SkeletonRow>
          <View style={styles.outerNav}>
            <SkeletonBlock height={10} width={72} />
            <SkeletonBlock height={10} width={64} />
            <SkeletonBlock height={10} width={48} />
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
  avatarCol: {
    flexGrow: 0,
    flexShrink: 0,
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
  pager: {
    minWidth: 0,
    width: '100%',
  },
  pagerChrome: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  switcher: {
    flexDirection: 'row',
    gap: 16,
  },
  metrics: {
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  dots: {
    justifyContent: 'center',
  },
  outerNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    minWidth: 0,
  },
})
