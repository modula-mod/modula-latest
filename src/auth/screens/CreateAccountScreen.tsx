import {useState} from 'react'
import {View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {getUserFacingErrorMessage, isModulaApiError} from '@/api/contracts/ApiError'
import {
  AuthField,
  AuthLink,
  AuthPanel,
  AuthShell,
  AppButton,
} from '@/auth/screens/AuthScreenPrimitives'
import {useSessionActions} from '@/auth/runtime'
import {AppText} from '@/components/primitives/AppText'
import {useApiMetadataQuery} from '@/data/query/useApiMetadataQuery'
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
  const metadataQuery = useApiMetadataQuery()
  const advertisedRegistrationMode = metadataQuery.data?.registration.mode
  const registrationMode = advertisedRegistrationMode ?? (inviteRequired ? 'invite-only' : null)
  const registrationPending = !registrationMode && !metadataQuery.isError
  const registrationUnavailable = !registrationMode && metadataQuery.isError
  const requiresInvite = registrationMode === 'invite-only'
  const registrationClosed = registrationMode === 'closed'
  const [step, setStep] = useState<Step>(inviteRequired ? 'invite' : 'email')
  const [inviteAccepted, setInviteAccepted] = useState(false)
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
  const activeStep: Step =
    requiresInvite && !inviteAccepted
      ? 'invite'
      : !requiresInvite && step === 'invite'
        ? 'email'
        : step

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
    if (registrationClosed) {
      setError('Registration is closed on this server.')
      return
    }
    if (requiresInvite && !inviteCode.trim()) {
      setError('An invite is required for this environment.')
      return
    }
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
    } catch (caught) {
      if (isModulaApiError(caught)) {
        if (caught.code === 'FORBIDDEN') {
          setError(
            requiresInvite
              ? 'Enter a valid invitation to create an account.'
              : 'Registration is not available on this server.',
          )
          return
        }
        if (caught.code === 'CONFLICT') {
          setError('That email or username is already registered.')
          return
        }
        setError(getUserFacingErrorMessage(caught))
        return
      }
      setError('Modula could not create the account. Try again.')
    } finally {
      setPending(false)
    }
  }

  const footerLinks = (
    <View style={{gap: spacing[2], marginTop: spacing[1]}}>
      <AuthLink onPress={() => router.push('/sign-in' as Href)}>
        Already have an account? Sign in
      </AuthLink>
      <AuthLink onPress={() => router.back()}>Back</AuthLink>
    </View>
  )

  if (registrationPending) {
    return (
      <AuthShell>
        <View style={{gap: spacing[4]}}>
          <View style={{gap: spacing[1]}}>
            <AppText variant="display">Checking registration</AppText>
            <AppText variant="caption" colour="textSecondary">
              Modula is confirming account creation policy with the server.
            </AppText>
          </View>
          <AuthPanel>{footerLinks}</AuthPanel>
        </View>
      </AuthShell>
    )
  }

  if (registrationUnavailable) {
    return (
      <AuthShell>
        <View style={{gap: spacing[4]}}>
          <View style={{gap: spacing[1]}}>
            <AppText variant="display">Registration unavailable</AppText>
            <AppText variant="caption" colour="textSecondary">
              Modula could not verify whether this server accepts new accounts.
            </AppText>
          </View>
          <AuthPanel>{footerLinks}</AuthPanel>
        </View>
      </AuthShell>
    )
  }

  if (registrationClosed) {
    return (
      <AuthShell>
        <View style={{gap: spacing[4]}}>
          <View style={{gap: spacing[1]}}>
            <AppText variant="display">Sign in only</AppText>
            <AppText variant="caption" colour="textSecondary">
              This Modula server is not accepting new account registrations.
            </AppText>
          </View>
          <AuthPanel>{footerLinks}</AuthPanel>
        </View>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <View style={{gap: spacing[4]}}>
        <View style={{gap: spacing[1]}}>
          <AppText variant="display">Create Modula Account</AppText>
          <AppText variant="caption" colour="textSecondary">
            {requiresInvite
              ? 'Enter your invitation to create a Greenfield account on this server.'
              : 'Your account is owned by Greenfield. External Networks are optional and configured later in Settings.'}
          </AppText>
        </View>
        <AuthPanel>
          {activeStep === 'invite' ? (
            <>
              <AuthField
                label="Invite code"
                value={inviteCode}
                onChangeText={setInviteCode}
                autoCapitalize="none"
                textContentType="oneTimeCode"
                error={error ?? undefined}
              />
              <AppText variant="caption" colour="textSecondary">
                Request access from the server operator if you do not have an invitation.
              </AppText>
              <AppButton
                onPress={() => {
                  if (requiresInvite && !inviteCode.trim()) {
                    setError('An invite is required for this environment.')
                    return
                  }
                  setInviteAccepted(true)
                  setError(null)
                  setStep('email')
                }}>
                Continue
              </AppButton>
            </>
          ) : null}

          {activeStep === 'email' ? (
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

          {activeStep === 'password' ? (
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

          {activeStep === 'handle' ? (
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

          {activeStep === 'terms' ? (
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

          {footerLinks}
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
