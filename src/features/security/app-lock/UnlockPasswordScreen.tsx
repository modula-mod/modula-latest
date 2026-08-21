import {useState} from 'react'
import {StyleSheet, TextInput, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'

import {AppButton} from '@/components/primitives/AppButton'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useAppLock} from '@/features/security/app-lock/app-lock-context'
import {APP_LOCK_ACCENT} from '@/features/security/app-lock/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type Props = {
  mode?: 'unlock' | 'setup'
  onSetupComplete?: (password: string) => void
  onSwitchMethod?: () => void
  title?: string
  subtitle?: string
}

export function UnlockPasswordScreen({
  mode = 'unlock',
  onSetupComplete,
  onSwitchMethod,
  title = 'Unlock Modula',
  subtitle = 'Enter Password',
}: Props) {
  const {colours, spacing, radius} = useThemeTokens()
  const insets = useSafeAreaInsets()
  const {unlockWithCredential, config} = useAppLock()
  const [password, setPassword] = useState('')
  const [visible, setVisible] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (password.length < 4 || busy) return
    if (mode === 'setup') {
      onSetupComplete?.(password)
      setPassword('')
      return
    }
    setBusy(true)
    const result = await unlockWithCredential('password', password)
    setBusy(false)
    if (!result.ok) {
      setError(result.message ?? 'Incorrect password')
      setPassword('')
    }
  }

  const hasPin = config.configuredMethods.includes('pin')

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colours.canvas,
          paddingTop: insets.top + spacing[8],
          paddingBottom: insets.bottom + spacing[6],
          paddingHorizontal: spacing[5],
          gap: spacing[5],
        },
      ]}>
      <View style={styles.header}>
        <Ionicons name="lock-closed-outline" size={36} color={APP_LOCK_ACCENT} />
        <AppText variant="headline" style={styles.center}>
          {title}
        </AppText>
        <AppText variant="caption" colour="textSecondary" style={styles.center}>
          {subtitle}
        </AppText>
      </View>

      <View
        style={[
          styles.field,
          {
            backgroundColor: colours.surfaceRaised,
            borderColor: colours.border,
            borderRadius: radius.full,
            paddingHorizontal: spacing[4],
          },
        ]}>
        <Ionicons name="lock-closed" size={18} color={colours.textTertiary} />
        <TextInput
          value={password}
          onChangeText={text => {
            setError(null)
            setPassword(text)
          }}
          secureTextEntry={!visible}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Password"
          placeholderTextColor={colours.textTertiary}
          style={[styles.input, {color: colours.text}]}
          onSubmitEditing={() => void submit()}
          accessibilityLabel="Password"
        />
        <AppPressable
          accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          onPress={() => setVisible(v => !v)}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={20} color={colours.textSecondary} />
        </AppPressable>
      </View>

      {error ? (
        <AppText variant="caption" style={{color: colours.destructive, textAlign: 'center'}}>
          {error}
        </AppText>
      ) : null}

      <AppButton
        onPress={() => void submit()}
        disabled={password.length < 4 || busy}
        style={{backgroundColor: APP_LOCK_ACCENT}}>
        {mode === 'setup' ? 'Continue' : 'Unlock'}
      </AppButton>

      {mode === 'unlock' && hasPin ? (
        <AppPressable onPress={onSwitchMethod} style={styles.alt}>
          <AppText variant="caption" colour="textSecondary">
            Use PIN instead
          </AppText>
        </AppPressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {flex: 1, justifyContent: 'center'},
  header: {alignItems: 'center', gap: 8},
  center: {textAlign: 'center'},
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 52,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {flex: 1, fontSize: 16, paddingVertical: 12},
  alt: {alignSelf: 'center'},
})
