import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PillProps = {
  label: string
  selected?: boolean
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export function Pill({label, selected, onPress, style}: PillProps) {
  const {colours, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityState={{selected}}
      onPress={onPress}
      style={[
        styles.pill,
        {
          backgroundColor: selected ? colours.accentSubtle : colours.surfaceMuted,
          borderColor: selected ? colours.accent : colours.border,
          borderRadius: radius.round,
          paddingHorizontal: spacing[3],
        },
        style,
      ]}>
      <AppText
        variant="label"
        style={{color: selected ? colours.accent : colours.textSecondary}}>
        {label}
      </AppText>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  pill: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
})
