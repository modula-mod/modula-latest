import type {ReactNode} from 'react'
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaCheckbox} from '@/platform/ui/controls/modula-checkbox'
import {ModulaChip, ModulaFilterChip} from '@/platform/ui/controls/modula-chip'
import {ModulaFieldShell, type ModulaFieldShellProps} from '@/platform/ui/controls/modula-field-shell'
import {ModulaRadioGroup, type ModulaChoice} from '@/platform/ui/controls/modula-radio-group'
import {ModulaSwitch, type ModulaSwitchProps} from '@/platform/ui/controls/modula-switch'
import {ModulaTextInput, type ModulaTextInputProps} from '@/platform/ui/controls/modula-text-input'
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

export type {ModulaChoice} from '@/platform/ui/controls/modula-radio-group'

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

export {ModulaChip, ModulaFilterChip, ModulaRadioGroup}

export const ModulaToggle = (props: ModulaSwitchProps) => <ModulaSwitch {...props} />
export const ModulaCheckboxField = ModulaCheckbox

const styles = StyleSheet.create({
  form: {
    alignSelf: 'stretch',
  },
})
