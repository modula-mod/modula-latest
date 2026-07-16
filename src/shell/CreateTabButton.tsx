import {useRouter} from 'expo-router'
import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {selectionHaptic} from '@/lib/haptics'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function CreateTabButton() {
  const router = useRouter()
  const {colours, radius} = useThemeTokens()

  return (
    <AppPressable
      accessibilityLabel="Create a post"
      onPress={() => {
        void selectionHaptic()
        router.push('/compose')
      }}
      style={[
        styles.button,
        {
          backgroundColor: colours.accent,
          borderRadius: radius.round,
        },
      ]}>
      <View style={styles.iconWrap}>
        <AppIcon name="create" colour={colours.accentForeground} size={28} />
      </View>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    minHeight: 52,
    minWidth: 52,
    width: 52,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
})
