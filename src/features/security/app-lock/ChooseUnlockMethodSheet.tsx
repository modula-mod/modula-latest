import {StyleSheet, View} from 'react-native'

import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {useAppLock} from '@/features/security/app-lock/app-lock-context'
import {
  APP_LOCK_ACCENT,
  UNLOCK_METHOD_COPY,
  type UnlockMethod,
} from '@/features/security/app-lock/types'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const METHOD_ICONS: Record<UnlockMethod, ModulaIconName> = {
  pin: 'board',
  password: 'privacy',
  pattern: 'integrations',
  biometric: 'fingerprint',
}

type Props = {
  isPresented: boolean
  onDismiss: () => void
  selectedId: UnlockMethod
  onSelect: (method: UnlockMethod) => void
}

export function ChooseUnlockMethodSheet({
  isPresented,
  onDismiss,
  selectedId,
  onSelect,
}: Props) {
  const {colours, spacing, radius} = useThemeTokens()
  const {biometric} = useAppLock()

  const methods: UnlockMethod[] = ['pin', 'password', 'pattern', 'biometric']

  return (
    <ModulaSheet
      isPresented={isPresented}
      onDismiss={onDismiss}
      detent="large"
      accessibilityLabel="Choose Unlock Method">
      <View style={{gap: spacing[3], paddingBottom: spacing[4]}}>
        <AppText variant="headline">Choose Unlock Method</AppText>
        {methods.map(method => {
          const selected = method === selectedId
          const copy = UNLOCK_METHOD_COPY[method]
          const disabled = method === 'biometric' && !biometric.available
          return (
            <AppPressable
              key={method}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{selected, disabled}}
              accessibilityLabel={`${copy.label}. ${copy.description}`}
              onPress={() => {
                onSelect(method)
                onDismiss()
              }}
              style={[
                styles.row,
                {
                  borderColor: selected ? APP_LOCK_ACCENT : colours.border,
                  backgroundColor: colours.surfaceRaised,
                  borderRadius: radius.lg,
                  padding: spacing[3],
                  gap: spacing[3],
                  opacity: disabled ? 0.45 : 1,
                },
              ]}>
              <ModulaIcon
                name={METHOD_ICONS[method]}
                size={22}
                colour={selected ? APP_LOCK_ACCENT : colours.textSecondary}
              />
              <View style={styles.textCol}>
                <AppText
                  variant="label"
                  style={{color: selected ? APP_LOCK_ACCENT : colours.text}}>
                  {copy.label}
                </AppText>
                <AppText variant="caption" colour="textSecondary">
                  {disabled
                    ? biometric.error ?? 'Unavailable on this device'
                    : copy.description}
                </AppText>
              </View>
              {selected ? <AppIcon name="check" colour={APP_LOCK_ACCENT} size={18} /> : null}
            </AppPressable>
          )
        })}
        <View style={[styles.disclaimer, {gap: spacing[2]}]}>
          <AppIcon name="security" colour={colours.textTertiary} size={16} />
          <AppText variant="caption" colour="textTertiary" style={{flex: 1}}>
            Local protection only. Never sent to Modula servers.
          </AppText>
        </View>
      </View>
    </ModulaSheet>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  textCol: {flex: 1, gap: 2},
  disclaimer: {flexDirection: 'row', alignItems: 'center', marginTop: 8},
})
