import {StyleSheet, View} from 'react-native'

import {SkeletonBlock, SkeletonRow} from '@/platform/ui/skeletons/SkeletonBlock'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ActivityRowSkeleton() {
  const {spacing} = useThemeTokens()

  return (
    <View style={[styles.wrap, {gap: spacing[2], paddingVertical: spacing[2]}]}>
      <SkeletonRow gap={spacing[3]} style={styles.row}>
        <SkeletonBlock height={42} width={42} borderRadius={21} />
        <View style={[styles.body, {gap: spacing[2]}]}>
          <SkeletonBlock height={14} width="88%" />
          <SkeletonBlock height={12} width="32%" />
        </View>
      </SkeletonRow>
    </View>
  )
}

export function ActivityListSkeleton({count = 5}: {count?: number}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2], padding: spacing[4]}}>
      <SkeletonBlock height={28} width="36%" />
      {Array.from({length: count}, (_, index) => (
        <ActivityRowSkeleton key={index} />
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minWidth: 0,
  },
  row: {
    alignItems: 'center',
    width: '100%',
  },
  wrap: {
    width: '100%',
  },
})
