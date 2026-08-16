import {StyleSheet, View} from 'react-native'

import {SkeletonBlock, SkeletonRow} from '@/platform/ui/skeletons/SkeletonBlock'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProfileHeroSkeleton() {
  const {spacing} = useThemeTokens()

  return (
    <View>
      <SkeletonBlock height={240} width="100%" borderRadius={0} />
      <View style={[styles.body, {gap: spacing[3], paddingHorizontal: spacing[4]}]}>
        <SkeletonBlock height={92} width={92} borderRadius={46} style={styles.avatar} />
        <View style={styles.actions} />
        <SkeletonBlock height={22} width="48%" />
        <SkeletonBlock height={14} width="36%" />
        <SkeletonBlock height={14} width="90%" />
        <SkeletonRow gap={spacing[5]}>
          <SkeletonBlock height={16} width={72} />
          <SkeletonBlock height={16} width={88} />
          <SkeletonBlock height={16} width={88} />
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
    marginTop: -46,
  },
  body: {
    width: '100%',
  },
})
