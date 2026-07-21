import {useState} from 'react'
import {View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AuthField, AuthPanel, AuthShell, AppButton} from '@/auth/screens/AuthScreenPrimitives'
import {AppText} from '@/components/primitives/AppText'
import {useAppServices} from '@/runtime/useAppServices'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ForgotPasswordScreen() {
  const router = useRouter()
  const services = useAppServices()
  const {spacing} = useThemeTokens()
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    setPending(true)
    try {
      await services.authRepository.forgotPassword({email: email.trim().toLowerCase()})
      setSubmitted(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <View style={{gap: spacing[4]}}>
        <AppText variant="display">Forgot password</AppText>
        <AuthPanel>
          <AppText variant="caption" colour="textSecondary">
            Enter the email for your Modula Account. If it exists, we will send reset instructions.
          </AppText>
          <AuthField
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            textContentType="emailAddress"
          />
          <AppButton disabled={pending} onPress={() => void submit()}>
            {pending ? 'Sending' : 'Send reset link'}
          </AppButton>
          {submitted ? (
            <AppText variant="caption" colour="textSecondary">
              If a matching Modula Account exists, reset instructions were accepted. Check your email,
              then continue to reset password.
            </AppText>
          ) : null}
          <AppButton variant="secondary" onPress={() => router.push('/reset-password' as Href)}>
            I have a reset code
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/sign-in' as Href)}>
            Back to sign in
          </AppButton>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
