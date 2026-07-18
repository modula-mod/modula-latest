import type {ReactNode} from 'react'
import {ScrollView, StyleSheet, Switch, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type SettingsNavRow = {
  title: string
  description?: string
  icon?: AppIconName
  value?: string
  route?: string
  onPress?: () => void
  preview?: boolean
}

/**
 * Canonical settings screen chrome:
 * SecondaryScreenHeader → optional caption → sectioned content.
 * Never repeat the header title as a display headline.
 */
export function SettingsScreen({
  title,
  caption,
  right,
  children,
}: {
  title: string
  caption?: string
  right?: ReactNode
  children: ReactNode
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={title} right={right} />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5], paddingBottom: spacing[8]}]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {caption ? <SettingsCaption>{caption}</SettingsCaption> : null}
          {children}
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

export function SettingsCaption({children}: {children: ReactNode}) {
  return (
    <AppText variant="caption" colour="textTertiary">
      {children}
    </AppText>
  )
}

export function SettingsSection({
  title,
  children,
}: {
  title?: string
  children: ReactNode
}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}}>
      {title ? (
        <AppText variant="label" colour="textSecondary">
          {title}
        </AppText>
      ) : null}
      <MaterialSurface role="card" style={styles.list}>
        {children}
      </MaterialSurface>
    </View>
  )
}

export function SettingsLinkRow({
  row,
  last,
}: {
  row: SettingsNavRow
  last?: boolean
}) {
  const router = useRouter()
  const {colours, spacing} = useThemeTokens()
  const title = row.preview ? `${row.title} — Preview` : row.title

  return (
    <AppPressable
      accessibilityLabel={title}
      onPress={() => {
        if (row.onPress) {
          row.onPress()
          return
        }
        if (row.route) {
          router.push(row.route as Href)
        }
      }}
      style={[
        styles.row,
        {
          borderBottomColor: last ? 'transparent' : colours.separator,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          gap: spacing[3],
        },
      ]}>
      {row.icon ? (
        <View
          style={[
            styles.iconWrap,
            {backgroundColor: colours.accentSubtle, borderColor: colours.accentBorder},
          ]}>
          <AppIcon name={row.icon} colour={colours.accent} size={20} />
        </View>
      ) : null}
      <View style={styles.rowText}>
        <AppText variant="label">{title}</AppText>
        {row.description ? (
          <AppText variant="caption" colour="textSecondary">
            {row.description}
          </AppText>
        ) : null}
      </View>
      {row.value ? (
        <AppText variant="caption" colour="textTertiary" numberOfLines={1}>
          {row.value}
        </AppText>
      ) : null}
      <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
    </AppPressable>
  )
}

export function SettingsToggleRow({
  label,
  description,
  value,
  onValueChange,
  last,
  preview,
}: {
  label: string
  description?: string
  value: boolean
  onValueChange: (next: boolean) => void
  last?: boolean
  preview?: boolean
}) {
  const {colours, spacing} = useThemeTokens()
  const title = preview ? `${label} — Preview` : label

  return (
    <View
      style={[
        styles.row,
        {
          borderBottomColor: last ? 'transparent' : colours.separator,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          gap: spacing[3],
        },
      ]}>
      <View style={styles.rowText}>
        <AppText variant="label">{title}</AppText>
        {description ? (
          <AppText variant="caption" colour="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={title}
        trackColor={{false: colours.border, true: colours.accentSubtle}}
        thumbColor={value ? colours.accent : colours.textMuted}
      />
    </View>
  )
}

/**
 * Value row that opens a ModulaMenu / action sheet of options.
 */
export function SettingsMenuRow({
  label,
  description,
  value,
  actions,
  onAction,
  last,
  preview,
  menuTitle,
}: {
  label: string
  description?: string
  value?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  last?: boolean
  preview?: boolean
  menuTitle?: string
}) {
  const {colours, spacing} = useThemeTokens()
  const title = preview ? `${label} — Preview` : label

  return (
    <ModulaMenu
      title={menuTitle ?? label}
      actions={actions}
      onAction={onAction}
      accessibilityLabel={`${title}. ${value ?? 'Choose option'}`}
      trigger={
        <View
          style={[
            styles.row,
            {
              borderBottomColor: last ? 'transparent' : colours.separator,
              paddingHorizontal: spacing[4],
              paddingVertical: spacing[3],
              gap: spacing[3],
            },
          ]}>
          <View style={styles.rowText}>
            <AppText variant="label">{title}</AppText>
            {description ? (
              <AppText variant="caption" colour="textSecondary">
                {description}
              </AppText>
            ) : null}
          </View>
          {value ? (
            <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
              {value}
            </AppText>
          ) : null}
          <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
        </View>
      }
    />
  )
}

/**
 * Long-press actions on a settings row.
 * Uses the imperative action sheet (not SwiftUI Host ContextMenu) so full-width
 * list rows are not crush-sized by Expo UI Host intrinsic layout.
 */
export function SettingsContextRow({
  title,
  actions,
  onAction,
  children,
}: {
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  children: ReactNode
}) {
  return (
    <AppPressable
      accessibilityLabel={title}
      onLongPress={() => {
        void presentModulaActions({title, actions}).then(id => {
          if (id) onAction(id)
        })
      }}
      style={styles.contextWrap}>
      {children}
    </AppPressable>
  )
}

/** Header overflow (⋯) for settings screens. */
export function SettingsOverflowMenu({
  title,
  actions,
  onAction,
}: {
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
}) {
  const {colours} = useThemeTokens()
  return (
    <ModulaMenu
      title={title}
      actions={actions}
      onAction={onAction}
      accessibilityLabel="More settings actions"
      trigger={<AppIcon name="more" colour={colours.textSecondary} />}
    />
  )
}

/**
 * @deprecated Prefer SettingsCaption — header already owns the screen title.
 * Kept so existing call sites only show the body as a caption.
 */
export function SettingsInfoBlock({
  title: _title,
  body,
}: {
  title?: string
  body: string
}) {
  return <SettingsCaption>{body}</SettingsCaption>
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
  },
  contextWrap: {
    alignSelf: 'stretch',
    width: '100%',
  },
  iconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    flexShrink: 0,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
    width: '100%',
  },
  rowText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  screen: {
    flex: 1,
  },
})
