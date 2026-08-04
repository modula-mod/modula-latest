import type {PropsWithChildren, ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import type {ModulaButtonRole} from '@/platform/ui/buttons/button-role'
import {ModulaSecureInput} from '@/platform/ui/controls/modula-secure-input'
import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AuthShell({children}: PropsWithChildren) {
  const {spacing} = useThemeTokens()
  return (
    <AppScreen scroll style={[styles.shell, {padding: spacing[4]}]}>
      {children}
    </AppScreen>
  )
}

export function AuthPanel({children}: PropsWithChildren) {
  const {spacing} = useThemeTokens()
  return (
    <Surface variant="contained" style={[styles.panel, {gap: spacing[4], padding: spacing[4]}]}>
      {children}
    </Surface>
  )
}

type AuthFieldProps = {
  label: string
  error?: string
  value: string
  onChangeText: (text: string) => void
  placeholder?: string
  secureTextEntry?: boolean
  autoFocus?: boolean
  editable?: boolean
  keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'url'
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  autoCorrect?: boolean
  autoComplete?: string
  /** RN textContentType — mapped to Expo UI autoComplete when possible. */
  textContentType?: string
  returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send'
  onSubmitEditing?: () => void
  testID?: string
}

function mapTextContentType(textContentType?: string): string | undefined {
  switch (textContentType) {
    case 'emailAddress':
      return 'email'
    case 'username':
      return 'username'
    case 'password':
      return 'password'
    case 'newPassword':
      return 'new-password'
    case 'oneTimeCode':
      return 'one-time-code'
    case 'name':
      return 'name'
    default:
      return undefined
  }
}

export function AuthField({
  label,
  error,
  secureTextEntry,
  textContentType,
  autoComplete,
  ...props
}: AuthFieldProps) {
  const {colours, spacing} = useThemeTokens()
  const Input = secureTextEntry ? ModulaSecureInput : ModulaTextInput

  return (
    <View style={{gap: spacing[2]}}>
      <AppText variant="label">{label}</AppText>
      <Input
        {...props}
        autoComplete={autoComplete ?? mapTextContentType(textContentType)}
        accessibilityLabel={label}
        style={{
          borderColor: error ? colours.destructive : colours.border,
        }}
      />
      {error ? (
        <AppText variant="caption" colour="destructive">
          {error}
        </AppText>
      ) : null}
    </View>
  )
}

/** Children-compatible auth CTA wrapping ModulaButton. */
export function AppButton({
  children,
  onPress,
  disabled,
  loading,
  variant = 'primary',
  testID,
}: {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  loading?: boolean
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive'
  testID?: string
}) {
  const role: ModulaButtonRole =
    variant === 'ghost'
      ? 'quiet'
      : variant === 'secondary'
        ? 'secondary'
        : variant === 'destructive'
          ? 'destructive'
          : 'primary'

  return (
    <ModulaButton
      label={typeof children === 'string' ? children : String(children)}
      onPress={onPress}
      role={role}
      disabled={disabled}
      loading={loading}
      testID={testID}
    />
  )
}

const styles = StyleSheet.create({
  panel: {
    width: '100%',
  },
  shell: {
    alignSelf: 'center',
    maxWidth: 560,
    width: '100%',
  },
})
