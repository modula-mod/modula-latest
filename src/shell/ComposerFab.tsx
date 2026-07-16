import {StyleSheet} from 'react-native'
import {router} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useTheme} from '@/theme/runtime/useTheme'

export function ComposerFab() {
  const {colours, spacing, radius} = useTheme()

  return (
    <AppPressable
      accessibilityLabel="Compose"
      onPress={() => router.push('/compose')}
      style={[
        styles.fab,
        {
          backgroundColor: colours.accent,
          bottom: spacing.xl,
          right: spacing.xl,
          borderRadius: radius.full,
        },
      ]}>
      <AppText variant="title" colour="accentForeground" style={styles.plus}>
        +
      </AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    marginTop: -2,
  },
})
