import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons/modula-icon'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaActionButtonEmphasis =
  | 'primary'
  | 'neutral'
  | 'inverse'
  | 'destructive'
  | 'quiet'

export type ModulaActionButtonSize = 'compact' | 'regular' | 'prominent'

export type ModulaActionButtonProps = {
  label: string
  accessibilityLabel?: string
  onPress?: () => void
  emphasis?: ModulaActionButtonEmphasis
  size?: ModulaActionButtonSize
  icon?: ModulaIconName
  disabled?: boolean
  loading?: boolean
  selected?: boolean
  loadingLabel?: string
  fullWidth?: boolean
  style?: StyleProp<ViewStyle>
  testID?: string
}

/**
 * Compact lifecycle/action CTA used by products and shell surfaces.
 * Visible geometry stays independent from the minimum 44pt press target.
 */
export function ModulaActionButton({
  label,
  accessibilityLabel,
  onPress,
  emphasis = 'neutral',
  size = 'compact',
  icon,
  disabled = false,
  loading = false,
  selected,
  loadingLabel,
  fullWidth = false,
  style,
  testID,
}: ModulaActionButtonProps) {
  const {colours, controls, radius, spacing} = useThemeTokens()
  const blocked = disabled || loading
  const backgroundColor =
    emphasis === 'primary'
      ? colours.accent
      : emphasis === 'inverse'
        ? colours.text
        : emphasis === 'destructive'
          ? colours.destructive
          : emphasis === 'quiet'
            ? 'transparent'
            : colours.surface
  const foregroundColor =
    emphasis === 'primary' || emphasis === 'destructive'
      ? colours.accentForeground
      : emphasis === 'inverse'
        ? colours.canvas
        : emphasis === 'quiet'
          ? colours.accent
          : colours.text
  const borderColor = emphasis === 'neutral' ? colours.border : 'transparent'
  const shownLabel = loading ? (loadingLabel ?? `${label}…`) : label

  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{busy: loading, disabled: blocked, selected}}
      disabled={blocked}
      onPress={onPress}
      testID={testID}
      style={[
        styles.target,
        {
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          minHeight: controls.touchTarget.minimum,
          opacity: blocked ? 0.55 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}>
      <View
        style={[
          styles.visual,
          {
            backgroundColor,
            borderColor,
            borderRadius: radius.round,
            gap: spacing[2],
            minHeight: controls.actionButton[size],
            paddingHorizontal: size === 'compact' ? spacing[3] : spacing[4],
            width: fullWidth ? '100%' : undefined,
          },
        ]}>
        {icon ? <ModulaIcon name={icon} size={16} colour={foregroundColor} /> : null}
        <AppText
          variant="buttonLabel"
          style={{color: foregroundColor, fontWeight: emphasis === 'quiet' ? '500' : '700'}}>
          {shownLabel}
        </AppText>
      </View>
    </AppPressable>
  )
}

const styles = StyleSheet.create({
  target: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  visual: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 4,
  },
})
