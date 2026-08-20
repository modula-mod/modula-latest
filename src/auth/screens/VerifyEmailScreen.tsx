import {useEffect, useRef, useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AuthPanel, AuthShell, AppButton} from '@/auth/screens/AuthScreenPrimitives'
import {ModulaOTPField} from '@/platform/ui/controls/modula-otp-field'
import {useSession, useSessionActions} from '@/auth/runtime'
import {AppText} from '@/components/primitives/AppText'
import {useHydrated} from '@/lib/useHydrated'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const RESEND_SECONDS = 45

function maskedEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return 'your email'
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2)
  return `${visible}${'•'.repeat(Math.max(2, Math.min(5, local.length - visible.length)))}@${domain}`
}

export function VerifyEmailScreen() {
  const params = useLocalSearchParams<{email?: string; token?: string; t?: string; c?: string; challengeId?: string}>()
  const session = useSession()
  const {verifyEmail, resendVerification} = useSessionActions()
  const router = useRouter()
  const hydrated = useHydrated()
  const {colours, spacing} = useThemeTokens()
  const email =
    (hydrated ? params.email : undefined) ??
    (session.status === 'pendingVerification' ? session.email : '')
  const pendingToken =
    (hydrated ? params.t : '') ||
    (hydrated ? params.token : '') ||
    (session.status === 'pendingVerification' ? session.verificationToken : '') ||
    ''
  const challengeId =
    (hydrated ? params.c : '') ||
    (hydrated ? params.challengeId : '') ||
    (session.status === 'pendingVerification' ? session.verificationChallengeId : '') ||
    ''
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [resendPending, setResendPending] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [success, setSuccess] = useState(false)
  const timerDestination = useRef('')

  useEffect(() => {
    if (!email || timerDestination.current === email) return
    timerDestination.current = email
    const startTimer = setTimeout(() => setResendIn(RESEND_SECONDS), 0)
    return () => clearTimeout(startTimer)
  }, [email])

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const timer = setInterval(() => setResendIn(current => Math.max(0, current - 1)), 1000)
    return () => clearInterval(timer)
  }, [resendIn])

  const effectiveCode = code ?? pendingToken

  const submit = async (value = effectiveCode) => {
    if (!value.trim()) {
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
          ? {challengeId, code: value.trim(), email}
          : {token: value.trim(), email},
      )
      setSuccess(true)
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message.toLowerCase() : ''
      setError(
        detail.includes('expired')
          ? 'That code has expired. Request a new one to continue.'
          : 'That code is not valid. Check the email and try again.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <View style={[styles.composition, {gap: spacing[4]}]}>
        <View style={{gap: spacing[2]}}>
          <View style={[styles.identity, {gap: spacing[2]}]}>
            <View style={[styles.identityMark, {borderColor: colours.accentBorder, backgroundColor: colours.accentSubtle}]}>
              <View style={[styles.identityCore, {backgroundColor: colours.accent}]} />
            </View>
            <AppText variant="caption" colour="accent">MODULA ACCOUNT</AppText>
          </View>
          <AppText variant="display">Check your email</AppText>
          <AppText variant="body" colour="textSecondary">
            Enter the six-digit code sent to {maskedEmail(email)}.
          </AppText>
        </View>
        <AuthPanel>
          <ModulaOTPField
            value={effectiveCode}
            onChangeValue={text => {
              setCode(text)
              if (error) setError(null)
            }}
            onComplete={value => void submit(value)}
            error={Boolean(error)}
            disabled={pending || success}
            autoFocus
            accessibilityLabel="Verification code"
            testID="verify-email-code"
          />
          {error ? (
            <AppText variant="caption" colour="destructive">
              {error}
            </AppText>
          ) : null}
          {success ? (
            <View accessibilityLiveRegion="polite" style={[styles.success, {gap: spacing[1]}]}>
              <AppText variant="label" colour="accent">Email verified</AppText>
              <AppText variant="caption" colour="textSecondary">Opening your Modula profile…</AppText>
            </View>
          ) : null}
          <AppButton testID="verify-email-submit" disabled={pending || success || effectiveCode.length !== 6} onPress={() => void submit()}>
            {pending ? 'Checking code…' : success ? 'Verified' : 'Continue'}
          </AppButton>
          <AppButton
            variant="secondary"
            disabled={!email || resendPending || resendIn > 0 || success}
            onPress={() => {
              if (!email) return
              setResendPending(true)
              setError(null)
              void resendVerification(email)
                .then(() => {
                  setMessage('A fresh code is on its way.')
                  setResendIn(RESEND_SECONDS)
                })
                .catch(() => setError('A new code could not be sent. Try again.'))
                .finally(() => setResendPending(false))
            }}>
            {resendPending
              ? 'Sending…'
              : resendIn > 0
                ? `Resend in ${resendIn}s`
                : 'Resend code'}
          </AppButton>
          {message ? (
            <AppText variant="caption" colour="textSecondary">
              {message}
            </AppText>
          ) : null}
          <View style={[styles.secondaryActions, {gap: spacing[2]}]}>
            <AppButton variant="ghost" onPress={() => router.push('/register' as Href)}>
              Edit email
            </AppButton>
            <AppButton variant="ghost" onPress={() => router.push('/sign-in' as Href)}>
              Sign in instead
            </AppButton>
          </View>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}

const styles = StyleSheet.create({
  composition: {
    flex: 1,
    justifyContent: 'center',
    minHeight: 560,
  },
  identity: {alignItems: 'center', flexDirection: 'row'},
  identityCore: {borderRadius: 6, height: 8, width: 8},
  identityMark: {alignItems: 'center', borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, height: 28, justifyContent: 'center', width: 28},
  secondaryActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  success: {
    alignItems: 'center',
    paddingVertical: 6,
  },
})
