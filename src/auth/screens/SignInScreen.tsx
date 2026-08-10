import {useState} from 'react'
import {View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {
  AuthField,
  AuthLink,
  AuthPanel,
  AuthShell,
  AppButton,
} from '@/auth/screens/AuthScreenPrimitives'
import {sanitizeReturnTo} from '@/auth/navigation/safeReturnTo'
import {useSession, useSessionActions} from '@/auth/runtime'
import {AppText} from '@/components/primitives/AppText'
import {runtimeEnvironment} from '@/config/runtimeEnvironment'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function SignInScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{returnTo?: string; email?: string}>()
  const session = useSession()
  const {signIn, continueAsDemo} = useSessionActions()
  const {spacing} = useThemeTokens()
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(
    session.status === 'signedOut' && session.error ? session.error : null,
  )
  const [pending, setPending] = useState(false)
  const returnTo = sanitizeReturnTo(params.returnTo)
  const showDemo =
    runtimeEnvironment.dataSource === 'local' &&
    (runtimeEnvironment.appEnvironment === 'development' ||
      runtimeEnvironment.appEnvironment === 'preview')

  const submit = async () => {
    const nextEmail = email.trim().toLowerCase()
    if (!validEmail(nextEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least eight characters.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await signIn({email: nextEmail, password}, returnTo)
      setPassword('')
    } catch {
      setError('Check your email and password, or verify your email first.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <View style={{gap: spacing[4]}}>
        <View style={{gap: spacing[1]}}>
          <AppText variant="display">Sign in</AppText>
          <AppText variant="caption" colour="textSecondary">
            Sign in with your Modula Account. External Networks are optional under Settings →
            Connections.
          </AppText>
        </View>
        <AuthPanel>
          <AuthField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
          />
          <AuthField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            error={error ?? undefined}
          />
          <AuthLink
            onPress={() => setShowPassword(value => !value)}>
            {showPassword ? 'Hide password' : 'Show password'}
          </AuthLink>
          <AppButton disabled={pending} onPress={() => void submit()}>
            {pending ? 'Signing in' : 'Sign in'}
          </AppButton>
          <View style={{gap: spacing[2], marginTop: spacing[1]}}>
            <AuthLink onPress={() => router.push('/forgot-password' as Href)}>
              Forgot password
            </AuthLink>
            <AuthLink onPress={() => router.push('/register' as Href)}>
              Create Modula Account
            </AuthLink>
            {showDemo ? (
              <AppButton
                variant="secondary"
                onPress={() =>
                  void continueAsDemo('andrei@modula.local').catch(error => {
                    setError(
                      error instanceof Error
                        ? error.message
                        : 'Development demo sign-in failed. Use a Greenfield account on remote.',
                    )
                  })
                }>
                Use development demo account
              </AppButton>
            ) : null}
            <AuthLink onPress={() => router.back()}>Back</AuthLink>
          </View>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
