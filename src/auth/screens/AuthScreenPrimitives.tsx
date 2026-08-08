import type {PropsWithChildren, ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppScreen} from '@/components/primitives/AppScreen'
import {AppText} from '@/components/primitives/AppText'
import {ModulaButton} from '@/platform/ui/buttons/modula-button'
import type {ModulaButtonRole} from '@/platform/ui/buttons/button-role'
import {ModulaSecureInput} from '@/platform/ui/controls/modula-secure-input'
import {ModulaTextInput} from '@/platform/ui/controls/modula-text-input'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AuthShell({children}: PropsWithChildren) {
  const {spacing} = useThemeTokens()
  return (
    <AppScreen
      scroll
      style={[
        styles.shell,
        {
          paddingTop: spacing[6],
          paddingBottom: spacing[8],
          gap: spacing[5],
        },
      ]}>
      {children}
    </AppScreen>
  )
}

export function AuthPanel({children}: PropsWithChildren) {
  const {spacing} = useThemeTokens()
  return <View style={[styles.panel, {gap: spacing[4]}]}>{children}</View>
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
  placeholder,
  ...props
}: AuthFieldProps) {
  const {colours, spacing} = useThemeTokens()
  const Input = secureTextEntry ? ModulaSecureInput : ModulaTextInput

  return (
    <View style={{gap: spacing[2], width: '100%'}}>
      <AppText variant="label" colour="textSecondary">
        {label}
      </AppText>
      <Input
        {...props}
        placeholder={placeholder ?? label}
        autoComplete={autoComplete ?? mapTextContentType(textContentType)}
        accessibilityLabel={label}
        style={{
          borderColor: error ? colours.destructive : colours.border,
          borderWidth: error ? 1.5 : StyleSheet.hairlineWidth,
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

export function AuthLink({
  children,
  onPress,
  testID,
}: {
  children: string
  onPress?: () => void
  testID?: string
}) {
  return (
    <AppPressable
      accessibilityRole="link"
      accessibilityLabel={children}
      onPress={onPress}
      testID={testID}
      style={styles.link}>
      <AppText variant="body" colour="accent" style={styles.linkText}>
        {children}
      </AppText>
    </AppPressable>
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

  const fullWidth = variant !== 'ghost'

  return (
    <ModulaButton
      label={typeof children === 'string' ? children : String(children)}
      onPress={onPress}
      role={role}
      disabled={disabled}
      loading={loading}
      fullWidth={fullWidth}
      testID={testID}
    />
  )
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'flex-start',
    minHeight: 36,
    justifyContent: 'center',
    paddingVertical: 4,
  },
  linkText: {
    fontWeight: '500',
  },
  panel: {
    width: '100%',
  },
  shell: {
    alignSelf: 'center',
    maxWidth: 480,
    width: '100%',
  },
})
