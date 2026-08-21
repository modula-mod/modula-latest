import {useState} from 'react'
import {Alert, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {SystemSwitch} from '@/components/system/SystemSwitch'
import {useAppLock} from '@/features/security/app-lock/app-lock-context'
import {ChooseUnlockMethodSheet} from '@/features/security/app-lock/ChooseUnlockMethodSheet'
import {UnlockPasswordScreen} from '@/features/security/app-lock/UnlockPasswordScreen'
import {UnlockPatternScreen} from '@/features/security/app-lock/UnlockPatternScreen'
import {UnlockPinScreen} from '@/features/security/app-lock/UnlockPinScreen'
import {
  APP_LOCK_ACCENT,
  AUTO_LOCK_OPTIONS,
  UNLOCK_METHOD_COPY,
  type UnlockMethod,
} from '@/features/security/app-lock/types'
import {
  SettingsScreen,
  SettingsSection,
  SettingsToggleRow,
} from '@/features/settings/components/SettingsRows'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const TILE_ICONS: Record<UnlockMethod, keyof typeof Ionicons.glyphMap> = {
  pin: 'grid-outline',
  password: 'lock-closed-outline',
  pattern: 'git-network-outline',
  biometric: 'finger-print-outline',
}

type SetupState =
  | null
  | {method: 'pin'; step: 'enter' | 'confirm'; first?: string}
  | {method: 'password'; step: 'enter' | 'confirm'; first?: string}
  | {method: 'pattern'; step: 'enter' | 'confirm'; first?: string}

export function AppLockSettingsPanel() {
  const {colours, spacing, radius} = useThemeTokens()
  const router = useRouter()
  const {
    config,
    biometric,
    setMethod,
    setAutoLock,
    setStepUp,
    setupCredential,
    setupBiometric,
    clearAll,
    setEnabled,
  } = useAppLock()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [setup, setSetup] = useState<SetupState>(null)

  const beginSetup = (method: UnlockMethod) => {
    if (method === 'biometric') {
      void (async () => {
        const result = await setupBiometric()
        if (!result.ok) {
          Alert.alert('Biometric unavailable', result.message ?? 'Could not enable biometrics.')
        }
      })()
      return
    }
    setSetup({method, step: 'enter'})
  }

  const onChooseMethod = (method: UnlockMethod) => {
    if (config.configuredMethods.includes(method)) {
      void setMethod(method)
      return
    }
    beginSetup(method)
  }

  if (setup?.method === 'pin') {
    return (
      <UnlockPinScreen
        mode={setup.step === 'enter' ? 'setup' : 'confirm'}
        title={setup.step === 'enter' ? 'Create PIN' : 'Confirm PIN'}
        subtitle={setup.step === 'enter' ? 'Choose a 6-digit PIN' : 'Enter the same PIN again'}
        onSetupComplete={pin => {
          if (setup.step === 'enter') {
            setSetup({method: 'pin', step: 'confirm', first: pin})
            return
          }
          if (setup.first !== pin) {
            Alert.alert('PIN mismatch', 'The PINs did not match. Try again.')
            setSetup({method: 'pin', step: 'enter'})
            return
          }
          void setupCredential('pin', pin).then(() => setSetup(null))
        }}
        onSwitchMethod={() => setSetup(null)}
      />
    )
  }

  if (setup?.method === 'password') {
    return (
      <UnlockPasswordScreen
        mode="setup"
        title={setup.step === 'enter' ? 'Create Password' : 'Confirm Password'}
        subtitle={
          setup.step === 'enter' ? 'Choose a local password' : 'Enter the same password again'
        }
        onSetupComplete={password => {
          if (setup.step === 'enter') {
            setSetup({method: 'password', step: 'confirm', first: password})
            return
          }
          if (setup.first !== password) {
            Alert.alert('Password mismatch', 'The passwords did not match. Try again.')
            setSetup({method: 'password', step: 'enter'})
            return
          }
          void setupCredential('password', password).then(() => setSetup(null))
        }}
        onSwitchMethod={() => setSetup(null)}
      />
    )
  }

  if (setup?.method === 'pattern') {
    return (
      <UnlockPatternScreen
        mode="setup"
        title={setup.step === 'enter' ? 'Create Pattern' : 'Confirm Pattern'}
        subtitle={
          setup.step === 'enter'
            ? 'Draw a local unlock pattern'
            : 'Draw the same pattern again'
        }
        onSetupComplete={pattern => {
          if (setup.step === 'enter') {
            setSetup({method: 'pattern', step: 'confirm', first: pattern})
            return
          }
          if (setup.first !== pattern) {
            Alert.alert('Pattern mismatch', 'The patterns did not match. Try again.')
            setSetup({method: 'pattern', step: 'enter'})
            return
          }
          void setupCredential('pattern', pattern).then(() => setSetup(null))
        }}
        onSwitchMethod={() => setSetup(null)}
      />
    )
  }

  const methods: UnlockMethod[] = ['pin', 'password', 'pattern', 'biometric']

  return (
    <SettingsScreen
      title="App Lock"
      caption="Local passcode and biometric protection for this device only.">
      <View
        style={[
          styles.banner,
          {
            backgroundColor: colours.surface,
            borderColor: colours.separator,
            borderRadius: radius.large,
            padding: spacing[4],
            gap: spacing[3],
          },
        ]}>
        <View style={[styles.bannerTitle, {gap: spacing[2]}]}>
          <AppIcon name="privacy" colour={APP_LOCK_ACCENT} size={20} />
          <AppText variant="label">Local App Lock</AppText>
        </View>
        <AppText variant="caption" colour="textSecondary">
          Protect sensitive data with a local passcode or biometric lock.
        </AppText>
        <View style={[styles.bannerTitle, {gap: spacing[2]}]}>
          <AppIcon name="security" colour={colours.textTertiary} size={16} />
          <AppText variant="caption" colour="textTertiary" style={{flex: 1}}>
            Protected only on this device. Never sent to Modula servers.
          </AppText>
        </View>
        <View style={[styles.enableRow, {gap: spacing[3]}]}>
          <View style={{flex: 1}}>
            <AppText variant="label">Enabled</AppText>
            <AppText variant="caption" colour="textTertiary">
              {config.configuredMethods.length
                ? `Using ${UNLOCK_METHOD_COPY[config.method].label}`
                : 'Choose an unlock method to enable'}
            </AppText>
          </View>
          <SystemSwitch
            value={config.enabled}
            label="App Lock enabled"
            onValueChange={next => {
              if (next && config.configuredMethods.length === 0) {
                setSheetOpen(true)
                return
              }
              void setEnabled(next)
            }}
          />
        </View>
      </View>

      <SettingsSection title="Unlock Method">
        <View
          style={[
            styles.tiles,
            {
              padding: spacing[3],
              gap: spacing[3],
            },
          ]}>
          {methods.map(method => {
            const selected = config.method === method && config.enabled
            const configured = config.configuredMethods.includes(method)
            const disabled = method === 'biometric' && !biometric.available
            return (
              <AppPressable
                key={method}
                disabled={disabled}
                accessibilityLabel={`${UNLOCK_METHOD_COPY[method].label}${selected ? ', selected' : ''}`}
                onPress={() => {
                  if (disabled) {
                    Alert.alert(
                      'Biometric unavailable',
                      biometric.error ?? 'Biometrics are not available on this device.',
                    )
                    return
                  }
                  if (configured) {
                    void setMethod(method)
                    return
                  }
                  beginSetup(method)
                }}
                onLongPress={() => setSheetOpen(true)}
                style={[
                  styles.tile,
                  {
                    borderColor: selected ? APP_LOCK_ACCENT : colours.border,
                    borderRadius: radius.md,
                    opacity: disabled ? 0.4 : 1,
                  },
                ]}>
                <Ionicons
                  name={TILE_ICONS[method]}
                  size={22}
                  color={selected ? APP_LOCK_ACCENT : colours.textSecondary}
                />
                <AppText
                  variant="caption"
                  style={{color: selected ? APP_LOCK_ACCENT : colours.text}}>
                  {UNLOCK_METHOD_COPY[method].label}
                </AppText>
              </AppPressable>
            )
          })}
        </View>
        <AppPressable
          onPress={() => setSheetOpen(true)}
          style={[
            styles.changeRow,
            {
              borderTopColor: colours.separator,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
            },
          ]}>
          <AppText variant="label" style={{color: APP_LOCK_ACCENT}}>
            Choose unlock method
          </AppText>
          <AppIcon name="chevronRight" colour={APP_LOCK_ACCENT} size={18} />
        </AppPressable>
      </SettingsSection>

      <SettingsSection title="Auto-Lock">
        <View
          style={[
            styles.chips,
            {
              padding: spacing[3],
              gap: spacing[2],
            },
          ]}>
          {AUTO_LOCK_OPTIONS.map(option => {
            const selected = config.autoLock === option.id
            return (
              <AppPressable
                key={option.id}
                onPress={() => void setAutoLock(option.id)}
                accessibilityState={{selected}}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? APP_LOCK_ACCENT : colours.border,
                    borderRadius: radius.full,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                  },
                ]}>
                <AppText
                  variant="caption"
                  style={{color: selected ? APP_LOCK_ACCENT : colours.textSecondary}}>
                  {option.label}
                </AppText>
              </AppPressable>
            )
          })}
        </View>
      </SettingsSection>

      <SettingsSection title="Require unlock">
        <SettingsToggleRow
          label="Require for Wallet"
          description="Lock when accessing Wallet."
          value={config.requireForWallet}
          onValueChange={next => void setStepUp('wallet', next)}
        />
        <SettingsToggleRow
          label="Require for Purchases"
          description="Lock when making purchases."
          value={config.requireForPurchases}
          onValueChange={next => void setStepUp('purchases', next)}
        />
        <SettingsToggleRow
          label="Require for Settings"
          description="Lock when accessing Settings."
          value={config.requireForSettings}
          onValueChange={next => void setStepUp('settings', next)}
          last
        />
      </SettingsSection>

      <SettingsSection title="This device">
        <AppPressable
          onPress={() => router.push('/settings/account/sessions' as Href)}
          style={[
            styles.changeRow,
            {
              borderTopColor: 'transparent',
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
            },
          ]}>
          <View style={{flex: 1, gap: 2}}>
            <AppText variant="body">Trusted devices & sessions</AppText>
            <AppText variant="caption" colour="textTertiary">
              Remote session revoke is separate from local App Lock. This device
              only stores unlock material on-device.
            </AppText>
          </View>
          <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
        </AppPressable>
        {config.configuredMethods.length > 0 ? (
          <AppPressable
            onPress={() => {
              Alert.alert(
                'Turn off App Lock?',
                'This removes local PIN, password, and pattern material from this device.',
                [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Turn off',
                    style: 'destructive',
                    onPress: () => void clearAll(),
                  },
                ],
              )
            }}
            style={[
              styles.changeRow,
              {
                borderTopColor: colours.separator,
                paddingHorizontal: spacing[4],
                paddingVertical: spacing[3],
              },
            ]}>
            <AppText variant="label" style={{color: colours.destructive}}>
              Remove local App Lock
            </AppText>
          </AppPressable>
        ) : null}
      </SettingsSection>

      <ChooseUnlockMethodSheet
        isPresented={sheetOpen}
        onDismiss={() => setSheetOpen(false)}
        selectedId={config.method}
        onSelect={onChooseMethod}
      />
    </SettingsScreen>
  )
}

const styles = StyleSheet.create({
  banner: {},
  bannerTitle: {flexDirection: 'row', alignItems: 'center'},
  enableRow: {flexDirection: 'row', alignItems: 'center'},
  tiles: {flexDirection: 'row', flexWrap: 'wrap'},
  tile: {
    width: '47%',
    flexGrow: 1,
    minHeight: 88,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chips: {flexDirection: 'row', flexWrap: 'wrap'},
  chip: {borderWidth: 1},
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 48,
  },
})
