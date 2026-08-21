import {Modal, StyleSheet, View} from 'react-native'
import {useMemo, useState} from 'react'

import {useAppLock} from '@/features/security/app-lock/app-lock-context'
import {UnlockBiometricScreen} from '@/features/security/app-lock/UnlockBiometricScreen'
import {UnlockPasswordScreen} from '@/features/security/app-lock/UnlockPasswordScreen'
import {UnlockPatternScreen} from '@/features/security/app-lock/UnlockPatternScreen'
import {UnlockPinScreen} from '@/features/security/app-lock/UnlockPinScreen'
import type {UnlockMethod} from '@/features/security/app-lock/types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {LAYERS} from '@/theme/tokens/layers'

/**
 * Full-screen overlay when local App Lock is enabled and locked.
 * Does not mount when lock is disabled — guest browse stays unaffected.
 */
export function AppLockGate() {
  const {ready, enabled, locked, config} = useAppLock()
  const {colours} = useThemeTokens()
  const [overrideMethod, setOverrideMethod] = useState<UnlockMethod | null>(null)

  const method = useMemo(() => {
    const preferred = overrideMethod ?? config.method
    if (config.configuredMethods.includes(preferred)) return preferred
    return config.configuredMethods[0] ?? 'pin'
  }, [config.configuredMethods, config.method, overrideMethod])

  if (!ready || !enabled || !locked) return null

  const cycleFallback = () => {
    const order: UnlockMethod[] = ['pin', 'password', 'pattern', 'biometric']
    const configured = order.filter(m => config.configuredMethods.includes(m))
    if (configured.length < 2) return
    const idx = configured.indexOf(method)
    const next = configured[(idx + 1) % configured.length]
    if (next) setOverrideMethod(next)
  }

  let body = null
  switch (method) {
    case 'password':
      body = <UnlockPasswordScreen onSwitchMethod={cycleFallback} />
      break
    case 'pattern':
      body = <UnlockPatternScreen onSwitchMethod={cycleFallback} />
      break
    case 'biometric':
      body = <UnlockBiometricScreen onSwitchMethod={cycleFallback} />
      break
    case 'pin':
    default:
      body = <UnlockPinScreen onSwitchMethod={cycleFallback} />
      break
  }

  return (
    <Modal
      visible
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={() => undefined}>
      <View style={[styles.fill, {backgroundColor: colours.canvas, zIndex: LAYERS.dialog}]}>
        {body}
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: {flex: 1},
})
