import {Host, TextInput, useNativeState, type TextInputRef} from '@expo/ui'
import {useEffect, useImperativeHandle, useRef, type Ref} from 'react'
import {
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type StyleProp,
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
  ref?: Ref<TextInputRef>
}

/**
 * Bridges RN string state to Expo UI ObservableState TextInput.
 * Only this adapter may import `@expo/ui` TextInput/Host.
 */
export function ModulaTextInput({
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
  ref,
}: ModulaTextInputProps) {
  const {colours, scheme} = useThemeTokens()
  const state = useNativeState(value)
  const innerRef = useRef<TextInputRef>(null)

  useEffect(() => {
    if (state.value !== value) {
      state.value = value
    }
  }, [state, value])

  useImperativeHandle(ref, () => ({
    focus: () => innerRef.current?.focus(),
    blur: () => innerRef.current?.blur(),
    clear: () => {
      state.value = ''
      innerRef.current?.clear()
    },
    isFocused: () => innerRef.current?.isFocused() ?? false,
    setSelection: (start, end) =>
      innerRef.current?.setSelection(start, end) ?? Promise.resolve(),
  }))

  return (
    <Host
      matchContents
      colorScheme={scheme}
      seedColor={colours.accent}
      style={[{minHeight: multiline ? 96 : 48, alignSelf: 'stretch'}, style]}
      accessibilityLabel={accessibilityLabel}>
      <TextInput
        ref={innerRef}
        value={state}
        onChangeText={onChangeText}
        placeholder={placeholder}
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
        placeholderTextColor={colours.textTertiary}
        textStyle={textStyle as never}
        testID={testID}
      />
    </Host>
  )
}
