import {useCallback, useState} from 'react'
import {StyleSheet, View} from 'react-native'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useAppLock} from '@/features/security/app-lock/app-lock-context'
import {APP_LOCK_ACCENT, PIN_LENGTH} from '@/features/security/app-lock/types'
import {ModulaIcon} from '@/platform/ui/icons'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const KEYS: {digit?: string; letters?: string; action?: 'backspace'}[][] = [
  [
    {digit: '1'},
    {digit: '2', letters: 'ABC'},
    {digit: '3', letters: 'DEF'},
  ],
  [
    {digit: '4', letters: 'GHI'},
    {digit: '5', letters: 'JKL'},
    {digit: '6', letters: 'MNO'},
  ],
  [
    {digit: '7', letters: 'PQRS'},
    {digit: '8', letters: 'TUV'},
    {digit: '9', letters: 'WXYZ'},
  ],
  [{}, {digit: '0'}, {action: 'backspace'}],
]

type Props = {
  mode?: 'unlock' | 'setup' | 'confirm'
  onSetupComplete?: (pin: string) => void
  onSwitchMethod?: () => void
  title?: string
  subtitle?: string
}

export function UnlockPinScreen({
  mode = 'unlock',
  onSetupComplete,
  onSwitchMethod,
  title = 'Unlock Modula',
  subtitle = 'Enter PIN',
}: Props) {
  const {colours, spacing, radius} = useThemeTokens()
  const insets = useSafeAreaInsets()
  const {unlockWithCredential, config} = useAppLock()
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = useCallback(
    async (value: string) => {
      if (value.length !== PIN_LENGTH || busy) return
      if (mode === 'setup' || mode === 'confirm') {
        onSetupComplete?.(value)
        setPin('')
        return
      }
      setBusy(true)
      const result = await unlockWithCredential('pin', value)
      setBusy(false)
      if (!result.ok) {
        setError(result.message ?? 'Incorrect PIN')
        setPin('')
      }
    },
    [busy, mode, onSetupComplete, unlockWithCredential],
  )

  const append = (digit: string) => {
    if (busy || pin.length >= PIN_LENGTH) return
    setError(null)
    const next = `${pin}${digit}`
    setPin(next)
    if (next.length === PIN_LENGTH) void submit(next)
  }

  const backspace = () => {
    setError(null)
    setPin(prev => prev.slice(0, -1))
  }

  const hasPassword = config.configuredMethods.includes('password')

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: colours.canvas,
          paddingTop: insets.top + spacing[6],
          paddingBottom: insets.bottom + spacing[4],
          paddingHorizontal: spacing[5],
        },
      ]}>
      <View style={styles.header}>
        <ModulaIcon name="security" size={36} colour={APP_LOCK_ACCENT} />
        <AppText variant="headline" style={styles.center}>
          {title}
        </AppText>
        <AppText variant="caption" colour="textSecondary" style={styles.center}>
          {subtitle}
        </AppText>
      </View>

      <View style={[styles.dots, {gap: spacing[3]}]}>
        {Array.from({length: PIN_LENGTH}).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              {
                borderColor: pin.length > i ? APP_LOCK_ACCENT : colours.border,
                backgroundColor: pin.length > i ? APP_LOCK_ACCENT : 'transparent',
              },
            ]}
          />
        ))}
      </View>

      {error ? (
        <AppText variant="caption" style={{color: colours.destructive, textAlign: 'center'}}>
          {error}
        </AppText>
      ) : (
        <View style={{height: 18}} />
      )}

      <View style={[styles.keypad, {gap: spacing[3]}]}>
        {KEYS.map((row, ri) => (
          <View key={ri} style={[styles.keyRow, {gap: spacing[5]}]}>
            {row.map((key, ki) => {
              if (key.action === 'backspace') {
                return (
                  <AppPressable
                    key={`bs-${ki}`}
                    accessibilityLabel="Delete"
                    onPress={backspace}
                    style={[styles.key, {borderColor: colours.border, borderRadius: radius.full}]}>
                    <ModulaIcon name="backspace" size={22} colour={colours.text} />
                  </AppPressable>
                )
              }
              if (!key.digit) {
                return <View key={`sp-${ki}`} style={styles.key} />
              }
              return (
                <AppPressable
                  key={key.digit}
                  accessibilityLabel={`Digit ${key.digit}`}
                  onPress={() => append(key.digit!)}
                  style={[styles.key, {borderColor: colours.border, borderRadius: radius.full}]}>
                  <AppText variant="headline">{key.digit}</AppText>
                  {key.letters ? (
                    <AppText variant="micro" colour="textTertiary">
                      {key.letters}
                    </AppText>
                  ) : null}
                </AppPressable>
              )
            })}
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        {mode === 'unlock' && hasPassword ? (
          <AppPressable onPress={onSwitchMethod} accessibilityLabel="Use Password">
            <AppText variant="label" style={{color: APP_LOCK_ACCENT}}>
              Use Password
            </AppText>
          </AppPressable>
        ) : (
          <View />
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {flex: 1, justifyContent: 'space-between'},
  header: {alignItems: 'center', gap: 8},
  center: {textAlign: 'center'},
  dots: {flexDirection: 'row', justifyContent: 'center', alignItems: 'center'},
  dot: {width: 14, height: 14, borderRadius: 7, borderWidth: 2},
  keypad: {alignItems: 'center'},
  keyRow: {flexDirection: 'row', justifyContent: 'center'},
  key: {
    width: 72,
    height: 72,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
})
