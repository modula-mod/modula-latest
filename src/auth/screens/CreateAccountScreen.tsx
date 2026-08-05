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
import {useSessionActions} from '@/auth/runtime'
import {AppText} from '@/components/primitives/AppText'
import {normaliseHandle, validateDisplayName, validateHandle} from '@/features/profile/utils/validators'
import {ModulaCheckbox} from '@/platform/ui/controls/modula-checkbox'
import {useAppServices} from '@/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type Step = 'invite' | 'email' | 'password' | 'handle' | 'terms'

export function CreateAccountScreen() {
  const params = useLocalSearchParams<{inviteRequired?: string}>()
  const router = useRouter()
  const {register} = useSessionActions()
  const {authRepository} = useAppServices()
  const {spacing} = useThemeTokens()
  const inviteRequired = params.inviteRequired === '1'
  const [step, setStep] = useState<Step>(inviteRequired ? 'invite' : 'email')
  const [inviteCode, setInviteCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const nextFromEmail = () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) {
      setError('Enter a valid email address.')
      return
    }
    const nameResult = validateDisplayName(displayName)
    if (!nameResult.valid) {
      setError(nameResult.message)
      return
    }
    setError(null)
    setStep('password')
  }

  const nextFromPassword = () => {
    if (password.length < 10 || password !== confirmation) {
      setError('Passwords must match and be at least 10 characters.')
      return
    }
    setError(null)
    setStep('handle')
  }

  const nextFromHandle = async () => {
    const handleResult = validateHandle(handle)
    if (!handleResult.valid) {
      setError(handleResult.message)
      return
    }
    setPending(true)
    setError(null)
    try {
      const availability = await authRepository.checkHandleAvailability(normaliseHandle(handle))
      if (!availability.available) {
        setError('That username is not available.')
        return
      }
      setStep('terms')
    } catch {
      setError('Unable to check username availability. Try again.')
    } finally {
      setPending(false)
    }
  }

  const submit = async () => {
    if (!acceptedTerms || !acceptedPrivacy) {
      setError('Accept the Terms and Privacy notice to continue.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await register({
        displayName: displayName.trim(),
        email,
        handle: normaliseHandle(handle),
        password,
        inviteCode: inviteCode.trim() || undefined,
        acceptedTerms: true,
      })
    } catch {
      setError('That email or handle is already in use, or the invite is invalid.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <View style={{gap: spacing[4]}}>
        <View style={{gap: spacing[1]}}>
          <AppText variant="display">Create Modula Account</AppText>
          <AppText variant="caption" colour="textSecondary">
            Your account is owned by Greenfield. External Networks are optional and configured later in
            Settings.
          </AppText>
        </View>
        <AuthPanel>
          {step === 'invite' ? (
            <>
              <AuthField
                label="Invite code"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="none"
                textContentType="oneTimeCode"
                error={error ?? undefined}
              />
              <AppButton
                onPress={() => {
                  if (!inviteCode.trim()) {
                    setError('An invite is required for this environment.')
                    return
                  }
                  setError(null)
                  setStep('email')
                }}>
                Continue
              </AppButton>
            </>
          ) : null}

          {step === 'email' ? (
            <>
              <AuthField
                label="Display name"
                value={displayName}
                onChangeText={setDisplayName}
                textContentType="name"
                returnKeyType="next"
              />
              <AuthField
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="next"
                error={error ?? undefined}
              />
              <AppButton onPress={nextFromEmail}>Continue</AppButton>
            </>
          ) : null}

          {step === 'password' ? (
            <>
              <AuthField
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
                returnKeyType="next"
              />
              <AuthField
                label="Confirm password"
                value={confirmation}
                onChangeText={setConfirmation}
                secureTextEntry
                textContentType="newPassword"
                returnKeyType="done"
                error={error ?? undefined}
              />
              <AppButton onPress={nextFromPassword}>Continue</AppButton>
            </>
          ) : null}

          {step === 'handle' ? (
            <>
              <AuthField
                label="Username"
                value={handle}
                onChangeText={value => setHandle(normaliseHandle(value))}
                autoCapitalize="none"
                textContentType="username"
                returnKeyType="done"
                error={error ?? undefined}
              />
              <AppText variant="caption" colour="textSecondary">
                Your username is public and can change later. Your account ID never changes.
              </AppText>
              <AppButton disabled={pending} onPress={() => void nextFromHandle()}>
                {pending ? 'Checking' : 'Continue'}
              </AppButton>
            </>
          ) : null}

          {step === 'terms' ? (
            <>
              <ModulaCheckbox
                value={acceptedTerms}
                onValueChange={setAcceptedTerms}
                label="I agree to the Terms of Use"
                testID="create-account-terms"
              />
              <ModulaCheckbox
                value={acceptedPrivacy}
                onValueChange={setAcceptedPrivacy}
                label="I acknowledge the Privacy notice"
                testID="create-account-privacy"
              />
              {error ? (
                <AppText variant="caption" colour="destructive">
                  {error}
                </AppText>
              ) : null}
              <AppButton disabled={pending} onPress={() => void submit()}>
                {pending ? 'Creating' : 'Create Modula Account'}
              </AppButton>
            </>
          ) : null}

          <View style={{gap: spacing[2], marginTop: spacing[1]}}>
            <AuthLink onPress={() => router.push('/sign-in' as Href)}>
              Already have an account? Sign in
            </AuthLink>
            <AuthLink onPress={() => router.back()}>Back</AuthLink>
          </View>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
