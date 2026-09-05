import {forwardRef} from 'react'
import {
  StyleSheet,
  TextInput,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type StyleProp,
  type TextInput as RNTextInput,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaTextInputProps = {
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  label?: string
  error?: string
  secureTextEntry?: boolean
  autoFocus?: boolean
  editable?: boolean
  multiline?: boolean
  keyboardType?: KeyboardTypeOptions
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  autoComplete?: string
  returnKeyType?: ReturnKeyTypeOptions
  onSubmitEditing?: () => void
  onFocus?: () => void
  onBlur?: () => void
  maxLength?: number
  accessibilityLabel?: string
  style?: StyleProp<ViewStyle>
  textStyle?: StyleProp<TextStyle>
  testID?: string
}

/** Web / fallback text field. */
export const ModulaTextInput = forwardRef<RNTextInput, ModulaTextInputProps>(
  function ModulaTextInput(
    {
      value,
      onChangeText,
      placeholder,
      secureTextEntry,
      autoFocus,
      editable = true,
      multiline,
      keyboardType,
      autoCapitalize,
      autoCorrect,
      autoComplete,
      returnKeyType,
      onSubmitEditing,
      onFocus,
      onBlur,
      maxLength,
      accessibilityLabel,
      style,
      textStyle,
      testID,
    },
    ref,
  ) {
    const {accessibility, colours, controls, radius, spacing, typography} = useThemeTokens()

    return (
      <TextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colours.textTertiary}
        secureTextEntry={secureTextEntry}
        autoFocus={autoFocus}
        editable={editable}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        autoComplete={autoComplete as never}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        onFocus={onFocus}
        onBlur={onBlur}
        maxLength={maxLength}
        accessibilityLabel={accessibilityLabel}
        allowFontScaling={accessibility.followSystemTextSize}
        testID={testID}
        style={[
          {
            minHeight: multiline
              ? controls.inputHeight.multilineMinimum
              : controls.inputHeight.singleLine,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colours.border,
            backgroundColor: colours.surfaceRaised,
            borderRadius: radius.medium,
            color: colours.text,
            ...typography.body,
            paddingHorizontal: spacing[4],
            paddingVertical: spacing[2],
          },
          style as never,
          textStyle,
        ]}
      />
    )
  },
)
