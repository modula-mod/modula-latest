import {StyleSheet, View} from 'react-native'

import {SkeletonBlock, SkeletonRow} from '@/platform/ui/skeletons/SkeletonBlock'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function FeedPostSkeleton() {
  const {spacing} = useThemeTokens()

  return (
    <View style={[styles.wrap, {gap: spacing[3], padding: spacing[4]}]}>
      <SkeletonRow gap={spacing[3]}>
        <SkeletonBlock height={42} width={42} borderRadius={21} />
        <View style={[styles.body, {gap: spacing[2]}]}>
          <SkeletonBlock height={14} width="42%" />
          <SkeletonBlock height={12} width="28%" />
          <SkeletonBlock height={14} width="92%" />
          <SkeletonBlock height={14} width="76%" />
          <SkeletonBlock height={160} width="100%" borderRadius={16} />
        </View>
      </SkeletonRow>
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minWidth: 0,
  },
  wrap: {
    width: '100%',
  },
})
