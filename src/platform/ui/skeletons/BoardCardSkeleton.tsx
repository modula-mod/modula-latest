import {StyleSheet, View} from 'react-native'

import {SkeletonBlock} from '@/platform/ui/skeletons/SkeletonBlock'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function BoardCardSkeleton() {
  const {spacing} = useThemeTokens()

  return (
    <View style={[styles.card, {gap: spacing[3], padding: spacing[4]}]}>
      <SkeletonBlock height={28} width={28} borderRadius={8} />
      <SkeletonBlock height={16} width="70%" />
      <SkeletonBlock height={12} width="90%" />
      <SkeletonBlock height={12} width="55%" />
    </View>
  )
}

export function BoardGridSkeleton({count = 6}: {count?: number}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={[styles.grid, {gap: spacing[3]}]}>
      {Array.from({length: count}, (_, index) => (
        <View key={index} style={styles.item}>
          <BoardCardSkeleton />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    minHeight: 156,
    width: '100%',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
  },
  item: {
    flexBasis: '48%',
    flexGrow: 1,
  },
})
