import {StyleSheet, View} from 'react-native'

import {SkeletonBlock, SkeletonRow} from '@/platform/ui/skeletons/SkeletonBlock'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ProfileHeroSkeleton() {
  const {spacing} = useThemeTokens()

  return (
    <View style={{gap: spacing[4]}}>
      <SkeletonBlock height={140} width="100%" borderRadius={0} />
      <View style={[styles.body, {gap: spacing[3], paddingHorizontal: spacing[4]}]}>
        <SkeletonBlock height={72} width={72} borderRadius={36} style={styles.avatar} />
        <SkeletonBlock height={22} width="48%" />
        <SkeletonBlock height={14} width="36%" />
        <SkeletonBlock height={14} width="90%" />
        <SkeletonBlock height={14} width="70%" />
        <SkeletonRow gap={spacing[2]}>
          <SkeletonBlock height={44} width="62%" borderRadius={22} />
          <SkeletonBlock height={44} width="28%" borderRadius={22} />
        </SkeletonRow>
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
})
