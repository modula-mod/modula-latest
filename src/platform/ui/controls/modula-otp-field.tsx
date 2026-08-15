import {useCallback, useRef, useState} from 'react'
import {
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type TextInput as RNTextInput,
} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaOTPFieldProps = {
  value: string
  onChangeValue: (code: string) => void
  /** Fired once when the code reaches `length`. */
  onComplete?: (code: string) => void
  length?: number
  error?: boolean
  disabled?: boolean
  autoFocus?: boolean
  accessibilityLabel?: string
  testID?: string
}

/**
 * One-time-code entry composed over a single native text input, so system
 * OTP autofill (`one-time-code`) works on every platform. The visible cells
 * are presentation only — focus, selection, and paste all belong to the
 * hidden input.
 */
export function ModulaOTPField({
  value,
  onChangeValue,
  onComplete,
  length = 6,
  error = false,
  disabled = false,
  autoFocus = false,
  accessibilityLabel,
  testID,
}: ModulaOTPFieldProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const inputRef = useRef<RNTextInput>(null)
  const [focused, setFocused] = useState(false)

  const handleChange = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, '').slice(0, length)
      onChangeValue(digits)
      if (digits.length === length && value !== digits) {
        onComplete?.(digits)
      }
    },
    [length, onChangeValue, onComplete, value],
  )

  const focusInput = useCallback(() => {
    inputRef.current?.focus()
  }, [])

  const activeIndex = Math.min(value.length, length - 1)

  return (
    <Pressable
      onPress={focusInput}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel ?? 'Verification code'}
      testID={testID}
      style={styles.root}>
      <View style={[styles.cells, {gap: spacing[2]}]}>
        {Array.from({length}, (_, index) => {
          const char = value[index] ?? ''
          const isActive = focused && index === activeIndex && !disabled
          return (
            <View
              key={index}
              style={[
                styles.cell,
                {
                  borderRadius: radius.medium,
                  borderColor: error
                    ? colours.destructive
                    : isActive
                      ? colours.accent
                      : colours.border,
                  borderWidth: isActive || error ? 2 : StyleSheet.hairlineWidth,
                  backgroundColor: colours.surfaceRaised,
                  opacity: disabled ? 0.5 : 1,
                },
              ]}>
              <AppText variant="title2">{char}</AppText>
            </View>
          )
        })}
      </View>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        editable={!disabled}
        autoFocus={autoFocus}
        keyboardType="number-pad"
        inputMode="numeric"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        caretHidden
        accessibilityLabel={accessibilityLabel ?? 'Verification code'}
        testID={testID ? `${testID}-input` : undefined}
        style={styles.hiddenInput}
      />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  root: {
    width: '100%',
  },
  cells: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  cell: {
    width: 44,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.01,
  },
})
