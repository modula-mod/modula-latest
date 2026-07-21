import {useState} from 'react'
import {View, StyleSheet} from 'react-native'

import {AppButton} from '@/components/primitives/AppButton'
import {AppText} from '@/components/primitives/AppText'
import {AuthField} from '@/auth/screens/AuthScreenPrimitives'
import {useAppServices} from '@/runtime/useAppServices'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function AccountPasswordScreen() {
  const services = useAppServices()
  const {colours, spacing} = useThemeTokens()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = async () => {
    if (newPassword.length < 10 || newPassword !== confirmation) {
      setError('New passwords must match and be at least 10 characters.')
      return
    }
    setPending(true)
    setError(null)
    setMessage(null)
    try {
      await services.authRepository.changePassword({currentPassword, newPassword})
      setCurrentPassword('')
      setNewPassword('')
      setConfirmation('')
      setMessage('Password updated.')
    } catch {
      setError('Could not update password. Check your current password and try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Password" />
      <ResponsiveContent>
        <View style={[styles.content, {gap: spacing[3], padding: spacing[4]}]}>
          <AuthField
            label="Current password"
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            textContentType="password"
          />
          <AuthField
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            textContentType="newPassword"
          />
          <AuthField
            label="Confirm new password"
            value={confirmation}
            onChangeText={setConfirmation}
            secureTextEntry
            textContentType="newPassword"
            error={error ?? undefined}
          />
          <AppButton disabled={pending} onPress={() => void submit()}>
            {pending ? 'Updating' : 'Update password'}
          </AppButton>
          {message ? (
            <AppText variant="caption" colour="textSecondary">
              {message}
            </AppText>
          ) : null}
        </View>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  content: {maxWidth: 560, width: '100%', alignSelf: 'center'},
  screen: {flex: 1},
})
