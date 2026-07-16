import {View} from 'react-native'
import {router, useLocalSearchParams} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

export default function ComingSoonScreen() {
  const {spacing} = useTheme()
  const params = useLocalSearchParams<{title?: string}>()
  const title = typeof params.title === 'string' ? params.title : 'Coming soon'

  return (
    <AppScreen>
      <View style={{flex: 1, justifyContent: 'center', gap: spacing.md}}>
        <AppText variant="title">{title}</AppText>
        <AppText colour="textSecondary">
          This surface foreshadows a future module or feature. It is intentionally
          stubbed in Phase 1.
        </AppText>
        <AppButton onPress={() => router.back()}>Go back</AppButton>
      </View>
    </AppScreen>
  )
}
