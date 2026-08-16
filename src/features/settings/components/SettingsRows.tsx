import type {ReactNode} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {SystemSwitch} from '@/components/system/SystemSwitch'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
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
  comingSoon?: boolean
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
  const tabPadding = useFloatingTabBarContentPadding()
  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title={title} right={right} />
      <ResponsiveContent>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {gap: spacing[5], paddingBottom: tabPadding},
          ]}
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
  const {colours, spacing, radius} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}}>
      {title ? (
        <AppText
          variant="caption"
          colour="textTertiary"
          style={{
            letterSpacing: 0.6,
            paddingHorizontal: spacing[4],
            textTransform: 'uppercase',
          }}>
          {title}
        </AppText>
      ) : null}
      <View
        style={[
          styles.list,
          {
            backgroundColor: colours.surface,
            borderColor: colours.separator,
            borderRadius: radius.large,
          },
        ]}>
        {children}
      </View>
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
  const title = row.comingSoon
    ? row.title
    : row.preview
      ? `${row.title} — Preview`
      : row.title
  const value = row.comingSoon ? row.value ?? 'Coming Soon' : row.value
  const accessibilityLabel = row.comingSoon ? `${row.title} — Coming Soon` : title

  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityState={row.comingSoon ? {disabled: true} : undefined}
      onPress={() => {
        if (row.comingSoon) return
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
      {row.icon ? <AppIcon name={row.icon} colour={colours.text} size={20} /> : null}
      <View style={styles.rowText}>
        <AppText variant="body">{title}</AppText>
        {row.description ? (
          <AppText variant="caption" colour="textTertiary" numberOfLines={1}>
            {row.description}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="caption" colour="textTertiary" numberOfLines={1}>
          {value}
        </AppText>
      ) : null}
      {row.comingSoon ? null : <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />}
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
      <SystemSwitch
        value={value}
        onValueChange={onValueChange}
        label={title}
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

/** Header overflow (⋯) — Board-style circular chrome control. */
export function SettingsOverflowMenu({
  title,
  actions,
  onAction,
}: {
  title?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
}) {
  return (
    <ChromeOverflowMenu
      title={title}
      actions={actions}
      onAction={onAction}
      accessibilityLabel="More settings actions"
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
  list: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 48,
    width: '100%',
  },
  rowText: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  screen: {
    flex: 1,
  },
})
