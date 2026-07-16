import {StyleSheet, View} from 'react-native'

import {SkeletonBlock, SkeletonRow} from '@/platform/ui/skeletons/SkeletonBlock'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function MessagesRowSkeleton() {
  const {spacing} = useThemeTokens()

  return (
    <SkeletonRow gap={spacing[3]} style={[styles.row, {paddingVertical: spacing[3]}]}>
      <SkeletonBlock height={48} width={48} borderRadius={24} />
      <View style={[styles.body, {gap: spacing[2]}]}>
        <SkeletonBlock height={14} width="46%" />
        <SkeletonBlock height={12} width="78%" />
      </View>
      <SkeletonBlock height={12} width={36} />
    </SkeletonRow>
  )
}

export function MessagesListSkeleton({count = 6}: {count?: number}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[1], padding: spacing[4]}}>
      {Array.from({length: count}, (_, index) => (
        <MessagesRowSkeleton key={index} />
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
})
