import {StyleSheet, View} from 'react-native'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {PostContextAction} from '@/features/social/posts/state/post-interaction-types'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ICONS: Record<string, AppIconName> = {
  share: 'share',
  copyLink: 'link',
  saveToVault: 'saved',
  mute: 'notifications',
  report: 'warning',
  block: 'warning',
  hide: 'close',
  quote: 'repost',
}

type PostContextMenuProps = {
  actions: PostContextAction[]
  onClose?: () => void
}

export function PostContextMenu({actions, onClose}: PostContextMenuProps) {
  const {colours, spacing} = useThemeTokens()
  const primary = actions.filter(action => !action.destructive).slice(0, 5)
  const secondary = actions.filter(action => action.destructive)

  const row = (action: PostContextAction) => (
    <AppPressable
      key={action.id}
      accessibilityLabel={action.label}
      accessibilityRole="menuitem"
      onPress={() => {
        action.handler()
        onClose?.()
      }}
      style={[styles.row, {gap: spacing[2], minHeight: 44}]}>
      <AppIcon
        name={ICONS[action.id] ?? 'more'}
        colour={action.destructive ? colours.destructive : colours.mediaOverlayIcon}
        size={18}
      />
      <AppText
        variant="label"
        style={{
          color: action.destructive ? colours.destructive : colours.mediaOverlayText,
          flex: 1,
        }}>
        {action.label}
      </AppText>
    </AppPressable>
  )

  return (
    <View accessibilityRole="menu" style={styles.menu}>
      {primary.map(row)}
      {secondary.length ? <View style={[styles.divider, {backgroundColor: colours.separator}]} /> : null}
      {secondary.map(row)}
    </View>
  )
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 8,
    opacity: 0.35,
  },
  menu: {
    flex: 1,
    justifyContent: 'center',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
