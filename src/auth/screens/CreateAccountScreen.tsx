import {useState} from 'react'
import {View} from 'react-native'
import {useLocalSearchParams} from 'expo-router'

import {AuthField, AuthPanel, AuthShell, AppButton} from '@/auth/screens/AuthScreenPrimitives'
import {sanitizeReturnTo} from '@/auth/navigation/safeReturnTo'
import {useSessionActions} from '@/auth/runtime'
import {AppText} from '@/components/primitives/AppText'
import {normaliseHandle, validateDisplayName, validateHandle} from '@/features/profile/utils/validators'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function CreateAccountScreen() {
  const params = useLocalSearchParams<{returnTo?: string}>()
  const {register} = useSessionActions()
  const {spacing} = useThemeTokens()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    const nameResult = validateDisplayName(displayName)
    const handleResult = validateHandle(handle)
    if (!nameResult.valid || !handleResult.valid) {
      if (!nameResult.valid) {
        setError(nameResult.message)
      } else if (!handleResult.valid) {
        setError(handleResult.message)
      }
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim().toLowerCase())) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 8 || password !== confirmation) {
      setError('Passwords must match and be at least eight characters.')
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
      }, sanitizeReturnTo(params.returnTo))
    } catch {
      setError('That local email or handle is already in use.')
    } finally {
      setPending(false)
    }
  }

  return (
    <AuthShell>
      <View style={{gap: spacing[4]}}>
        <AppText variant="display">Create account</AppText>
        <AuthPanel>
          <AppText variant="caption" colour="textSecondary">
            This creates a temporary local prototype account.
          </AppText>
          <AuthField label="Display name" value={displayName} onChangeText={setDisplayName} />
          <AuthField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <AuthField label="Handle" value={handle} onChangeText={value => setHandle(normaliseHandle(value))} autoCapitalize="none" />
          <AuthField label="Password" value={password} onChangeText={setPassword} secureTextEntry />
          <AuthField label="Password confirmation" value={confirmation} onChangeText={setConfirmation} secureTextEntry error={error ?? undefined} />
          <AppButton disabled={pending} onPress={() => void submit()}>
            {pending ? 'Creating' : 'Create local account'}
          </AppButton>
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
