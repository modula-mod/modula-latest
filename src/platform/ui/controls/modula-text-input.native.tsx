import {useImperativeHandle, useRef, type Ref} from 'react'
import {
  StyleSheet,
  TextInput,
  View,
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
  ref?: Ref<RNTextInput>
}

/**
 * Native text field adapter.
 *
 * `@expo/ui` universal TextInput inside Host+`matchContents` collapses to an
 * invisible hit target on SDK 57.0.7 (labels only, no field chrome). Product
 * forms need a reliable, bordered field — so this adapter uses RN TextInput
 * with theme chrome while remaining the only import surface for screens.
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
  const {colours, radius, spacing} = useThemeTokens()
  const inputRef = useRef<RNTextInput>(null)

  useImperativeHandle(ref, () => inputRef.current as RNTextInput)

  return (
    <View
      style={[
        styles.shell,
        {
          minHeight: multiline ? 112 : 48,
          borderColor: colours.border,
          backgroundColor: colours.surfaceRaised,
          borderRadius: radius.medium,
          paddingHorizontal: spacing[3],
          paddingVertical: multiline ? spacing[3] : 0,
        },
        style,
      ]}>
      <TextInput
        ref={inputRef}
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
        testID={testID}
        style={[
          styles.field,
          {
            color: colours.text,
            minHeight: multiline ? 88 : 48,
            paddingVertical: multiline ? 0 : spacing[3],
          },
          textStyle,
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    fontSize: 17,
    lineHeight: 22,
    margin: 0,
    padding: 0,
    width: '100%',
  },
  shell: {
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
    width: '100%',
  },
})
