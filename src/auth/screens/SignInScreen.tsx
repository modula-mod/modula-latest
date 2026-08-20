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

type AuthStep = 'identity' | 'password' | 'emailCode'

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
  const [step, setStep] = useState<AuthStep>('identity')
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

  const continueFromIdentity = () => {
    const nextEmail = email.trim().toLowerCase()
    if (!validEmail(nextEmail)) {
      setEmailError('Enter a valid email address.')
      setFormError(null)
      return
    }
    setEmailError(null)
    setFormError(null)
    setStep('password')
  }

  const submit = async () => {
    const nextEmail = email.trim().toLowerCase()
    if (!validEmail(nextEmail)) {
      setEmailError('Enter a valid email address.')
      setFormError(null)
      setStep('identity')
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
      setStep('identity')
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
      setStep('emailCode')
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
      setStep('identity')
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
      <View style={{gap: spacing[5]}}>
        <View style={{gap: spacing[2]}}>
          <AppText variant="display">Modula</AppText>
          <AppText variant="headline">Sign in</AppText>
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
            returnKeyType={step === 'identity' ? 'next' : 'done'}
            onSubmitEditing={step === 'identity' ? continueFromIdentity : undefined}
            error={emailError ?? undefined}
            testID="sign-in-email"
          />
          {step === 'identity' ? (
            <AppButton testID="sign-in-continue" disabled={pending} onPress={continueFromIdentity}>
              Continue
            </AppButton>
          ) : null}
          {step === 'password' ? (
            <>
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
                {showPassword ? 'Hide' : 'Show'}
              </AuthLink>
              <AppButton testID="sign-in-submit" disabled={pending} onPress={() => void submit()}>
                {pending ? 'Signing in' : 'Sign in'}
              </AppButton>
              <AuthLink testID="sign-in-email-code-request" onPress={() => void requestEmailCode()}>
                Use a sign-in code instead
              </AuthLink>
            </>
          ) : null}
          {step === 'emailCode' ? (
            <>
              {emailCodeMessage ? (
                <AppText variant="caption" colour="textSecondary">
                  {emailCodeMessage}
                </AppText>
              ) : null}
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
              <AuthLink onPress={() => setStep('password')}>Use password instead</AuthLink>
            </>
          ) : null}
          {formError && step !== 'password' ? (
            <AppText variant="caption" colour="destructive">
              {formError}
            </AppText>
          ) : null}
          <View style={{gap: spacing[2], marginTop: spacing[2]}}>
            {step !== 'identity' ? (
              <AuthLink onPress={() => router.push('/forgot-password' as Href)}>Forgot password</AuthLink>
            ) : null}
            <AuthLink onPress={() => router.push('/register' as Href)}>Create account</AuthLink>
            {showDemo ? (
              <AuthLink
                onPress={() =>
                  void continueAsDemo('andrei@modula.local', returnTo).catch(error => {
                    setFormError(
                      error instanceof Error
                        ? error.message
                        : 'Development demo sign-in failed. Use a Greenfield account on remote.',
                    )
                  })
                }>
                Development demo
              </AuthLink>
            ) : null}
          </View>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
