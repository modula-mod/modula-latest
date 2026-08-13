import {useState} from 'react'
import {View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AuthField, AuthPanel, AuthShell, AppButton} from '@/auth/screens/AuthScreenPrimitives'
import {useSession, useSessionActions} from '@/auth/runtime'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function VerifyEmailScreen() {
  const params = useLocalSearchParams<{email?: string; token?: string; t?: string; c?: string; challengeId?: string}>()
  const session = useSession()
  const {verifyEmail, resendVerification} = useSessionActions()
  const router = useRouter()
  const {spacing} = useThemeTokens()
  const email =
    params.email ??
    (session.status === 'pendingVerification' ? session.email : '')
  const pendingToken =
    params.t ||
    params.token ||
    (session.status === 'pendingVerification' ? session.verificationToken : '') ||
    ''
  const challengeId =
    params.c ||
    params.challengeId ||
    (session.status === 'pendingVerification' ? session.verificationChallengeId : '') ||
    ''
  const [code, setCode] = useState(pendingToken)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    if (!code.trim()) {
      setError('Enter the verification code from your email.')
      return
    }
    if (!challengeId && !pendingToken) {
      setError('Request a new verification code to continue.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await verifyEmail(
        challengeId
          ? {challengeId, code: code.trim(), email}
          : {token: code.trim(), email},
      )
    } catch {
      setError('That verification code is invalid or expired.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <View style={{gap: spacing[4]}}>
        <View style={{gap: spacing[1]}}>
          <AppText variant="display">Verify email</AppText>
          <AppText variant="caption" colour="textSecondary">
            Confirm {email || 'your email'} to activate your Modula Account, then enter Modula.
          </AppText>
        </View>
        <AuthPanel>
          <AuthField
            label="Verification code"
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            textContentType="oneTimeCode"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            error={error ?? undefined}
            testID="verify-email-code"
          />
          <AppButton testID="verify-email-submit" disabled={pending} onPress={() => void submit()}>
            {pending ? 'Verifying' : 'Verify and enter Modula'}
          </AppButton>
          <AppButton
            variant="secondary"
            onPress={() => {
              if (!email) return
              void resendVerification(email).then(() =>
                setMessage('If an account is pending, a new code was sent.'),
              )
            }}>
            Resend verification
          </AppButton>
          {message ? (
            <AppText variant="caption" colour="textSecondary">
              {message}
            </AppText>
          ) : null}
          <AppButton variant="ghost" onPress={() => router.push('/sign-in' as Href)}>
            Sign in instead
          </AppButton>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
