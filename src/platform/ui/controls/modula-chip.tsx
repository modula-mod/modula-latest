import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaChipProps = {
  label: string
  selected?: boolean
  onPress: () => void
  disabled?: boolean
  filter?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function ModulaChip({
  label,
  selected = false,
  onPress,
  disabled,
  filter = false,
  style,
  testID,
}: ModulaChipProps) {
  const {colours, controls, radius, spacing} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{selected, disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colours.accentSubtle : colours.surfaceRaised,
          borderColor: selected ? colours.accentBorder : colours.border,
          borderRadius: radius.round,
          gap: spacing[1],
          minHeight: controls.touchTarget.minimum,
          opacity: disabled ? 0.45 : 1,
          paddingHorizontal: spacing[3],
        },
        style,
      ]}
      testID={testID}>
      {filter && selected ? <ModulaIcon name="check" colour={colours.accent} size={14} /> : null}
      <AppText variant="buttonLabel" colour={selected ? 'accent' : 'text'}>{label}</AppText>
    </AppPressable>
  )
}

export const ModulaFilterChip = (props: Omit<ModulaChipProps, 'filter'>) => (
  <ModulaChip {...props} filter />
)

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
  },
})
