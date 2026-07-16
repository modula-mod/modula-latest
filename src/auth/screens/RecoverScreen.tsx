import {useState} from 'react'
import {View} from 'react-native'

import {AuthField, AuthPanel, AuthShell, AppButton} from '@/auth/screens/AuthScreenPrimitives'
import {AppText} from '@/components/primitives/AppText'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export function RecoverScreen() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const {spacing} = useThemeTokens()
  return (
    <AuthShell>
      <View style={{gap: spacing[4]}}>
        <AppText variant="display">Recover access</AppText>
        <AuthPanel>
          <AuthField label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
          <AppButton onPress={() => setSubmitted(true)}>Continue</AppButton>
          {submitted ? (
            <AppText variant="caption" colour="textSecondary">
              If a matching prototype account exists, recovery instructions would be sent. No email is sent in this build.
            </AppText>
          ) : null}
        </AuthPanel>
      </View>
    </AuthShell>
  )
}
