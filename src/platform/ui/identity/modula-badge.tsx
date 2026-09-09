import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaBadgeTone =
  | 'neutral'
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'destructive'
  | 'info'

export type ModulaBadgeProps = {
  label: string
  tone?: ModulaBadgeTone
  icon?: ModulaIconName
  style?: StyleProp<ViewStyle>
}

export function ModulaBadge({label, tone = 'neutral', icon, style}: ModulaBadgeProps) {
  const {colours, radius, spacing} = useThemeTokens()
  const colour =
    tone === 'accent'
      ? colours.accent
      : tone === 'success'
        ? colours.success
        : tone === 'warning'
          ? colours.warning
          : tone === 'danger' || tone === 'destructive'
            ? colours.destructive
            : tone === 'info'
              ? colours.info
              : colours.textSecondary
  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colour,
          borderRadius: radius.round,
          gap: spacing[1],
          paddingHorizontal: spacing[2],
        },
        style,
      ]}>
      {icon ? <ModulaIcon name={icon} size={13} colour={colour} /> : null}
      <AppText variant="metadata" style={{color: colour, fontWeight: '700'}}>{label}</AppText>
    </View>
  )
}

export const ModulaStatusBadge = ModulaBadge
export const ModulaVerifiedBadge = ({label = 'Verified'}: {label?: string}) => (
  <ModulaBadge icon="check" label={label} tone="accent" />
)
export const ModulaBetaBadge = ({label = 'Beta'}: {label?: string}) => (
  <ModulaBadge label={label} tone="warning" />
)
export const ModulaCountBadge = ({count}: {count: number}) => (
  <ModulaBadge label={count > 99 ? '99+' : String(count)} tone="accent" />
)

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 24,
    paddingVertical: 3,
  },
})
