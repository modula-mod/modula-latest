import {forwardRef, useImperativeHandle, useRef, type CSSProperties, type KeyboardEvent, type RefObject} from 'react'
import {
  StyleSheet,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type StyleProp,
  type TextInput as RNTextInput,
  type TextStyle,
  type ViewStyle,
} from 'react-native'

import {KonstaListInputFrame} from '@/platform/ui/adapters/konsta/list-input-frame.web'
import {useSystemAccessibility} from '@/theme/accessibility/useSystemAccessibility'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {modulaWebCssVariables} from '@/platform/web-ui/theme'

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
  chrome?: 'field' | 'plain'
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

function inputType(keyboardType: KeyboardTypeOptions | undefined, secure: boolean | undefined) {
  if (secure) return 'password'
  if (keyboardType === 'email-address') return 'email'
  if (keyboardType === 'phone-pad') return 'tel'
  if (keyboardType === 'url') return 'url'
  return 'text'
}

function inputMode(keyboardType: KeyboardTypeOptions | undefined) {
  if (keyboardType === 'decimal-pad') return 'decimal'
  if (keyboardType === 'number-pad' || keyboardType === 'numeric') return 'numeric'
  if (keyboardType === 'email-address') return 'email'
  if (keyboardType === 'phone-pad') return 'tel'
  if (keyboardType === 'url') return 'url'
  return 'text'
}

/** Browser-native input/textarea for selection, IME, autofill and password managers. */
export const ModulaTextInput = forwardRef<RNTextInput, ModulaTextInputProps>(function ModulaTextInput({
  value,
  onChangeText,
  placeholder,
  label,
  error,
  secureTextEntry,
  autoFocus,
  editable = true,
  multiline,
  chrome = 'field',
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
}: ModulaTextInputProps, forwardedRef) {
  const elementRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const tokens = useThemeTokens()
  const {reduceTransparency} = useSystemAccessibility()
  const errorId = testID && error ? `${testID}-error` : undefined
  const variables = modulaWebCssVariables(tokens, {reduceTransparency})
  const flattenedTextStyle = StyleSheet.flatten(textStyle) as unknown as CSSProperties
  const common = {
    'aria-describedby': errorId,
    'aria-invalid': Boolean(error),
    'aria-label': accessibilityLabel ?? label ?? placeholder,
    autoCapitalize,
    autoComplete,
    autoCorrect: autoCorrect ? 'on' : 'off',
    autoFocus,
    className: 'modula-web-ui modula-web-input',
    'data-plain': String(chrome === 'plain'),
    'data-testid': testID,
    disabled: !editable,
    maxLength,
    onBlur,
    onChange: (event: {currentTarget: {value: string}}) => onChangeText(event.currentTarget.value),
    onFocus,
    placeholder,
    spellCheck: autoCorrect,
    style: {...variables, ...flattenedTextStyle},
    value,
  } as const

  useImperativeHandle(forwardedRef, () => elementRef.current as unknown as RNTextInput)

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (!onSubmitEditing) return
    if ((!multiline && event.key === 'Enter') || (multiline && event.key === 'Enter' && (event.metaKey || event.ctrlKey))) {
      if (multiline) event.preventDefault()
      onSubmitEditing()
    }
  }

  const input = multiline ? (
        <textarea
          {...common}
          enterKeyHint={returnKeyType as 'done' | 'enter' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined}
          onKeyDown={onKeyDown}
          ref={elementRef as RefObject<HTMLTextAreaElement>}
          rows={4}
        />
      ) : (
        <input
          {...common}
          enterKeyHint={returnKeyType as 'done' | 'enter' | 'go' | 'next' | 'previous' | 'search' | 'send' | undefined}
          inputMode={inputMode(keyboardType)}
          onKeyDown={onKeyDown}
          ref={elementRef as RefObject<HTMLInputElement>}
          type={inputType(keyboardType, secureTextEntry)}
        />
      )
  return (
    <View style={style}>
      {chrome === 'plain' ? input : (
        <KonstaListInputFrame error={error} label={label}>
          {input}
        </KonstaListInputFrame>
      )}
      {error ? <span className="modula-web-input-error" id={errorId} role="alert">{error}</span> : null}
    </View>
  )
})
