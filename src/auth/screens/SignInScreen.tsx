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
import {ModulaOTPField} from '@/platform/ui/controls/modula-otp-field'
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
  const {signIn, requestEmailSignInCode, signInWithEmailCode, continueAsDemo} = useSessionActions()
  const {spacing} = useThemeTokens()
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '')
  const [password, setPassword] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [emailCodeChallengeId, setEmailCodeChallengeId] = useState('')
  const [emailCodeMessage, setEmailCodeMessage] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(
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
      setEmailError('Enter a valid email address.')
      setFormError(null)
      return
    }
    if (password.length < 8) {
      setEmailError(null)
      setFormError('Password must be at least eight characters.')
      return
    }
    setPending(true)
    setEmailError(null)
    setFormError(null)
    try {
      await signIn({email: nextEmail, password}, returnTo)
      setPassword('')
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim().length > 0
          ? error.message
          : 'Check your email and password, or verify your email first.'
      setFormError(message)
    } finally {
      setPending(false)
    }
  }

  const requestEmailCode = async () => {
    const nextEmail = email.trim().toLowerCase()
    if (!validEmail(nextEmail)) {
      setEmailError('Enter a valid email address.')
      setFormError(null)
      return
    }
    setPending(true)
    setEmailError(null)
    setFormError(null)
    try {
      const requested = await requestEmailSignInCode(nextEmail)
      setEmailCodeChallengeId(requested.challengeId)
      setEmailCode('')
      setEmailCodeMessage(`If available, a code was sent to ${requested.delivery.recipient}.`)
    } catch {
      setFormError('Modula could not request a sign-in code. Try again.')
    } finally {
      setPending(false)
    }
  }

  const submitEmailCode = async () => {
    const nextEmail = email.trim().toLowerCase()
    if (!validEmail(nextEmail)) {
      setEmailError('Enter a valid email address.')
      setFormError(null)
      return
    }
    if (!emailCodeChallengeId || !emailCode.trim()) {
      setEmailError(null)
      setFormError('Enter the sign-in code from your email.')
      return
    }
    setPending(true)
    setEmailError(null)
    setFormError(null)
    try {
      await signInWithEmailCode(
        {email: nextEmail, challengeId: emailCodeChallengeId, code: emailCode.trim()},
        returnTo,
      )
      setEmailCode('')
    } catch {
      setFormError('That sign-in code is invalid or expired.')
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
            onChangeText={text => {
              setEmail(text)
              if (emailError) setEmailError(null)
            }}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
            returnKeyType="next"
            error={emailError ?? undefined}
            testID="sign-in-email"
          />
          <AuthField
            label="Password"
            value={password}
            onChangeText={text => {
              setPassword(text)
              if (formError) setFormError(null)
            }}
            secureTextEntry={!showPassword}
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            error={formError ?? undefined}
            testID="sign-in-password"
          />
          <AuthLink testID="sign-in-toggle-password" onPress={() => setShowPassword(value => !value)}>
            {showPassword ? 'Hide password' : 'Show password'}
          </AuthLink>
          <AppButton testID="sign-in-submit" disabled={pending} onPress={() => void submit()}>
            {pending ? 'Signing in' : 'Sign in'}
          </AppButton>
          <AppButton
            testID="sign-in-email-code-request"
            variant="secondary"
            disabled={pending}
            onPress={() => void requestEmailCode()}>
            Email me a sign-in code
          </AppButton>
          {emailCodeChallengeId ? (
            <>
              <ModulaOTPField
                value={emailCode}
                onChangeValue={setEmailCode}
                accessibilityLabel="Email sign-in code"
                testID="sign-in-email-code"
              />
              <AppButton
                testID="sign-in-email-code-submit"
                disabled={pending}
                onPress={() => void submitEmailCode()}>
                {pending ? 'Checking code' : 'Continue with email code'}
              </AppButton>
            </>
          ) : null}
          {emailCodeMessage ? (
            <AppText variant="caption" colour="textSecondary">
              {emailCodeMessage}
            </AppText>
          ) : null}
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
                    setFormError(
                      error instanceof Error
                        ? error.message
                        : 'Development demo sign-in failed. Use a Greenfield account on remote.',
                    )
                  })
                }>
                Use development demo account
              </AppButton>
            ) : null}
          </View>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
