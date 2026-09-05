import {useEffect, useState} from 'react'
import {ActivityIndicator, StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useAppLock} from '@/features/security/app-lock/app-lock-context'
import {APP_LOCK_ACCENT} from '@/features/security/app-lock/types'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type Props = {
  onSwitchMethod?: () => void
  autoPrompt?: boolean
}

export function UnlockBiometricScreen({onSwitchMethod, autoPrompt = true}: Props) {
  const {colours, spacing} = useThemeTokens()
  const insets = useSafeAreaInsets()
  const {biometricUnlock, biometric, config} = useAppLock()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const prompt = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    const result = await biometricUnlock()
    setBusy(false)
    if (!result.ok) setError(result.message ?? 'Authentication failed')
  }

  useEffect(() => {
    if (!autoPrompt || !biometric.available) return
    const handle = setTimeout(() => {
      void prompt()
    }, 0)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- prompt once when biometric becomes available
  }, [autoPrompt, biometric.available])

  const fallback =
    config.configuredMethods.find(m => m === 'password') ??
    config.configuredMethods.find(m => m === 'pin') ??
    config.configuredMethods.find(m => m === 'pattern')

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
        <ModulaIcon name="scan" size={36} colour={APP_LOCK_ACCENT} />
        <AppText variant="headline" style={styles.center}>
          Unlock with Device
        </AppText>
        <AppText variant="caption" colour="textSecondary" style={styles.center}>
          {biometric.available
            ? `Use ${biometric.label} to unlock Modula`
            : biometric.error ?? 'Biometric unlock is unavailable on this device.'}
        </AppText>
      </View>

      <AppPressable
        onPress={() => void prompt()}
        disabled={!biometric.available || busy}
        accessibilityLabel="Authenticate with biometrics"
        style={styles.fingerprint}>
        {busy ? (
          <ActivityIndicator color={APP_LOCK_ACCENT} />
        ) : (
          <ModulaIcon name="fingerprint" size={88} colour={APP_LOCK_ACCENT} />
        )}
      </AppPressable>

      {error ? (
        <AppText variant="caption" style={{color: colours.destructive, textAlign: 'center'}}>
          {error}
        </AppText>
      ) : null}

      {fallback && onSwitchMethod ? (
        <AppPressable onPress={onSwitchMethod} style={styles.alt}>
          <AppText variant="caption" colour="textSecondary">
            Use {fallback === 'pin' ? 'PIN' : fallback === 'password' ? 'Password' : 'Pattern'}
          </AppText>
        </AppPressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  header: {alignItems: 'center', gap: 8},
  center: {textAlign: 'center'},
  fingerprint: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: APP_LOCK_ACCENT,
  },
  alt: {alignSelf: 'center'},
})
