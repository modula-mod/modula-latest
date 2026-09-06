import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native'

import {AppImage} from '@/components/primitives/AppImage'
import {AppText} from '@/components/primitives/AppText'
import {ModulaActionButton, type ModulaActionButtonProps} from '@/platform/ui/buttons/modula-action-button'
import {ModulaIcon} from '@/platform/ui/icons'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'
import {ModulaListAvatar, ModulaListRow} from '@/platform/ui/lists'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaBadgeTone = 'neutral' | 'accent' | 'success' | 'warning' | 'destructive'

export function ModulaBadge({
  label,
  tone = 'neutral',
  icon,
  style,
}: {
  label: string
  tone?: ModulaBadgeTone
  icon?: ModulaIconName
  style?: StyleProp<ViewStyle>
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const colour =
    tone === 'accent'
      ? colours.accent
      : tone === 'success'
        ? colours.success
        : tone === 'warning'
          ? colours.warning
          : tone === 'destructive'
            ? colours.destructive
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

export function ModulaProductArtwork({
  name,
  uri,
  size = 48,
  provenance,
}: {
  name: string
  uri?: string
  size?: number
  provenance?: string
}) {
  const {colours, radius} = useThemeTokens()
  return (
    <View
      accessibilityLabel={[name, provenance].filter(Boolean).join(', ')}
      accessibilityRole="image"
      style={[
        styles.artwork,
        {
          backgroundColor: colours.surfaceRaised,
          borderColor: colours.border,
          borderRadius: Math.min(radius.medium, size * 0.24),
          height: size,
          width: size,
        },
      ]}>
      {uri ? (
        <AppImage source={{uri}} style={{height: size, width: size}} transition={120} />
      ) : (
        <ModulaIcon name="module" size={Math.round(size * 0.48)} colour={colours.accent} />
      )}
    </View>
  )
}

export const ModulaProductIcon = ModulaProductArtwork
export const ModulaProductCover = ModulaProductArtwork

export function ModulaProductRow({
  name,
  subtitle,
  metadata,
  artworkUri,
  action,
  onPress,
  last,
}: {
  name: string
  subtitle?: string
  metadata?: string
  artworkUri?: string
  action?: Pick<ModulaActionButtonProps, 'label' | 'onPress' | 'loading' | 'disabled' | 'emphasis'>
  onPress?: () => void
  last?: boolean
}) {
  return (
    <ModulaListRow
      description={subtitle}
      last={last}
      leading={<ModulaProductArtwork name={name} uri={artworkUri} />}
      metadata={metadata}
      onPress={onPress}
      title={name}
      trailing={action ? <ModulaActionButton {...action} /> : undefined}
      variant="product"
    />
  )
}

export function ModulaUserRow({
  name,
  handle,
  avatarUri,
  metadata,
  onPress,
  last,
}: {
  name: string
  handle?: string
  avatarUri?: string
  metadata?: string
  onPress?: () => void
  last?: boolean
}) {
  return (
    <ModulaListRow
      description={handle}
      last={last}
      leading={<ModulaListAvatar name={name} uri={avatarUri} />}
      metadata={metadata}
      onPress={onPress}
      title={name}
      variant="person"
    />
  )
}

const styles = StyleSheet.create({
  artwork: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  badge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 24,
    paddingVertical: 3,
  },
})
