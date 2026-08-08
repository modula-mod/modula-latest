import {useState} from 'react'
import {View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AuthField, AuthPanel, AuthShell, AppButton} from '@/auth/screens/AuthScreenPrimitives'
import {AppText} from '@/components/primitives/AppText'
import {useAppServices} from '@/runtime/useAppServices'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function ResetPasswordScreen() {
  const params = useLocalSearchParams<{token?: string}>()
  const router = useRouter()
  const services = useAppServices()
  const {spacing} = useThemeTokens()
  const [token, setToken] = useState(params.token ?? '')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    if (password.length < 10 || password !== confirmation) {
      setError('Passwords must match and be at least 10 characters.')
      return
    }
    if (!token.trim()) {
      setError('Enter the reset code from your email.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await services.authRepository.resetPassword({
        token: token.trim(),
        newPassword: password,
      })
      setDone(true)
    } catch {
      setError('That reset code is invalid or expired.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <View style={{gap: spacing[4]}}>
        <AppText variant="display">Reset password</AppText>
        <AuthPanel>
          <AuthField
            label="Reset code"
            value={token}
            onChangeText={setToken}
            autoCapitalize="none"
            textContentType="oneTimeCode"
          />
          <AuthField
            label="New password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
          />
          <AuthField
            label="Confirm password"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            textContentType="newPassword"
            error={error ?? undefined}
          />
          <AppButton disabled={pending} onPress={() => void submit()}>
            {pending ? 'Updating' : 'Update password'}
          </AppButton>
          {done ? (
            <AppText variant="caption" colour="textSecondary">
              Password updated. Sign in with your new password.
            </AppText>
          ) : null}
          <AppButton variant="ghost" onPress={() => router.push('/sign-in' as Href)}>
            Sign in
          </AppButton>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
