import {useState} from 'react'
import {View} from 'react-native'
import {useLocalSearchParams, useRouter, type Href} from 'expo-router'

import {AuthField, AuthPanel, AuthShell, AppButton} from '@/auth/screens/AuthScreenPrimitives'
import {sanitizeReturnTo} from '@/auth/navigation/safeReturnTo'
import {useSessionActions} from '@/auth/runtime'
import {AppText} from '@/components/primitives/AppText'
import {AppPressable} from '@/components/primitives/AppPressable'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function SignInScreen() {
  const router = useRouter()
  const params = useLocalSearchParams<{returnTo?: string}>()
  const {signIn} = useSessionActions()
  const {spacing} = useThemeTokens()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const returnTo = sanitizeReturnTo(params.returnTo)

  const submit = async (demoEmail?: string) => {
    const nextEmail = (demoEmail ?? email).trim().toLowerCase()
    const nextPassword = demoEmail ? 'modula-local-password' : password
    if (!validEmail(nextEmail)) {
      setError('Enter a valid email address.')
      return
    }
    if (nextPassword.length < 8) {
      setError('Password must be at least eight characters.')
      return
    }
    setPending(true)
    setError(null)
    try {
      await signIn({email: nextEmail, password: nextPassword}, returnTo)
      setPassword('')
    } catch {
      setError('Use an approved Modula Account.')
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
            Sign in with your Modula Account. External Networks are optional and configured later in
            Settings → Connections.
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
            error={error && !validEmail(email.trim().toLowerCase()) ? error : undefined}
          />
          <AuthField
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            textContentType="password"
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            error={error && validEmail(email.trim().toLowerCase()) ? error : undefined}
          />
          <AppPressable
            accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
            onPress={() => setShowPassword(value => !value)}>
            <AppText variant="caption" colour="accent">
              {showPassword ? 'Hide password' : 'Show password'}
            </AppText>
          </AppPressable>
          <AppButton disabled={pending} onPress={() => void submit()}>
            {pending ? 'Signing in' : 'Sign in'}
          </AppButton>
          <AppButton variant="secondary" onPress={() => void submit('andrei@modula.local')}>
            Use Andrei demo account
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/recover' as Href)}>
            Forgot password
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.back()}>
            Back
          </AppButton>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
