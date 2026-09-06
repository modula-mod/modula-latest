import type {ReactNode} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaCheckbox} from '@/platform/ui/controls/modula-checkbox'
import {ModulaFieldShell, type ModulaFieldShellProps} from '@/platform/ui/controls/modula-field-shell'
import {ModulaSwitch, type ModulaSwitchProps} from '@/platform/ui/controls/modula-switch'
import {ModulaTextInput, type ModulaTextInputProps} from '@/platform/ui/controls/modula-text-input'
import {ModulaIcon} from '@/platform/ui/icons'
import {ModulaListRow} from '@/platform/ui/lists'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ModulaForm({children, style, testID}: {children: ReactNode; style?: StyleProp<ViewStyle>; testID?: string}) {
  const {spacing} = useThemeTokens()
  return <View style={[styles.form, {gap: spacing[5]}, style]} testID={testID}>{children}</View>
}

export function ModulaFormSection({
  title,
  description,
  children,
}: {
  title?: string
  description?: string
  children: ReactNode
}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[3]}}>
      {title || description ? (
        <View style={{gap: spacing[1]}}>
          {title ? <AppText variant="headline">{title}</AppText> : null}
          {description ? <AppText variant="caption" colour="textSecondary">{description}</AppText> : null}
        </View>
      ) : null}
      {children}
    </View>
  )
}

export const ModulaField = ModulaFieldShell
export type ModulaFieldProps = ModulaFieldShellProps

export function ModulaTextArea(props: ModulaTextInputProps) {
  return <ModulaTextInput {...props} multiline />
}

export type ModulaChoice = {
  id: string
  label: string
  description?: string
  disabled?: boolean
}

export function ModulaChoiceRow({
  choice,
  selected,
  onPress,
  multiple = false,
  last,
}: {
  choice: ModulaChoice
  selected: boolean
  onPress: () => void
  multiple?: boolean
  last?: boolean
}) {
  return (
    <ModulaListRow
      accessibilityRole={multiple ? 'checkbox' : 'radio'}
      accessibilityState={{checked: selected, disabled: choice.disabled}}
      accessory="check"
      description={choice.description}
      disabled={choice.disabled}
      last={last}
      onPress={onPress}
      selected={selected}
      title={choice.label}
      variant="action"
    />
  )
}

export function ModulaRadioGroup({
  label,
  choices,
  value,
  onValueChange,
}: {
  label: string
  choices: ModulaChoice[]
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <View accessibilityLabel={label} accessibilityRole="radiogroup">
      {choices.map((choice, index) => (
        <ModulaChoiceRow
          choice={choice}
          key={choice.id}
          last={index === choices.length - 1}
          onPress={() => onValueChange(choice.id)}
          selected={choice.id === value}
        />
      ))}
    </View>
  )
}

export function ModulaChip({
  label,
  selected = false,
  onPress,
  disabled,
  filter = false,
}: {
  label: string
  selected?: boolean
  onPress: () => void
  disabled?: boolean
  filter?: boolean
}) {
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
      ]}>
      {filter && selected ? <ModulaIcon name="check" colour={colours.accent} size={14} /> : null}
      <AppText variant="buttonLabel" colour={selected ? 'accent' : 'text'}>{label}</AppText>
    </AppPressable>
  )
}

export const ModulaFilterChip = (props: Omit<Parameters<typeof ModulaChip>[0], 'filter'>) => (
  <ModulaChip {...props} filter />
)

export const ModulaToggle = (props: ModulaSwitchProps) => <ModulaSwitch {...props} />
export const ModulaCheckboxField = ModulaCheckbox

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  form: {
    alignSelf: 'stretch',
  },
})
