import type {ReactNode} from 'react'
import {StyleSheet, View} from 'react-native'

import {AppImage} from '@/components/primitives/AppImage'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaActionButton, type ModulaActionButtonProps} from '@/platform/ui/buttons/modula-action-button'
import {ModulaIcon} from '@/platform/ui/icons'
import {ModulaListAvatar, ModulaListRow} from '@/platform/ui/lists'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

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
  artwork,
  publisher,
  action,
  trailing,
  onPress,
  last,
  stacked,
  testID,
}: {
  name: string
  subtitle?: string
  metadata?: string
  artworkUri?: string
  artwork?: ReactNode
  publisher?: string
  action?: Pick<ModulaActionButtonProps, 'label' | 'onPress' | 'loading' | 'disabled' | 'emphasis'>
  trailing?: ReactNode
  onPress?: () => void
  last?: boolean
  stacked?: boolean
  testID?: string
}) {
  const {spacing} = useThemeTokens()
  const identity = (
    <View style={[styles.identityContent, {gap: spacing[3]}]}>
      {artwork ?? <ModulaProductArtwork name={name} uri={artworkUri} />}
      <View style={styles.productCopy}>
        <AppText variant="productName" numberOfLines={stacked ? 2 : 1}>{name}</AppText>
        {subtitle ? (
          <AppText variant="productSubtitle" colour="textSecondary" numberOfLines={stacked ? 2 : 1}>
            {subtitle}
          </AppText>
        ) : null}
        {publisher ? (
          <AppText variant="publisher" colour="textTertiary" numberOfLines={1}>{publisher}</AppText>
        ) : null}
      </View>
    </View>
  )
  return (
    <ModulaListRow
      last={last}
      metadata={metadata}
      stacked={stacked}
      testID={testID}
      trailing={trailing ?? (action ? <ModulaActionButton {...action} /> : undefined)}
      variant="product"
    >
      {onPress ? (
        <AppPressable accessibilityLabel={`Open ${name}`} onPress={onPress} style={styles.identityPress}>
          {identity}
        </AppPressable>
      ) : identity}
    </ModulaListRow>
  )
}

export function ModulaUserRow({
  name,
  handle,
  avatarUri,
  metadata,
  action,
  onPress,
  last,
}: {
  name: string
  handle?: string
  avatarUri?: string
  metadata?: string
  action?: Pick<ModulaActionButtonProps, 'label' | 'accessibilityLabel' | 'onPress' | 'loading' | 'disabled' | 'emphasis' | 'selected'>
  onPress?: () => void
  last?: boolean
}) {
  const {spacing} = useThemeTokens()
  const identity = (
    <View style={[styles.identityContent, {gap: spacing[3]}]}>
      <ModulaListAvatar name={name} uri={avatarUri} />
      <View style={styles.productCopy}>
        <AppText variant="rowTitle">{name}</AppText>
        {handle ? <AppText variant="caption" colour="textSecondary">{handle}</AppText> : null}
      </View>
    </View>
  )
  return (
    <ModulaListRow
      last={last}
      metadata={metadata}
      trailing={action ? <ModulaActionButton {...action} /> : undefined}
      variant="person"
    >
      {onPress ? (
        <AppPressable accessibilityLabel={`Open ${name}`} onPress={onPress} style={styles.identityPress}>
          {identity}
        </AppPressable>
      ) : identity}
    </ModulaListRow>
  )
}

const styles = StyleSheet.create({
  artwork: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  identityContent: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  identityPress: {
    flex: 1,
    minWidth: 0,
  },
  productCopy: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
})
