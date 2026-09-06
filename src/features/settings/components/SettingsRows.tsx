import type {ReactNode} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {SystemSwitch} from '@/components/system/SystemSwitch'
import {
  ModulaIconTile,
  ModulaListRow,
  ModulaListSection,
} from '@/platform/ui/lists'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {ModulaIcon} from '@/platform/ui/icons/modula-icon'
import {
  MODULA_ICONS,
  type ModulaIconName,
} from '@/platform/ui/icons/modula-icon-registry'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {
  adaptivePreferenceLabel,
  SYSTEM_ADAPTIVE_OPTIONS,
} from '@/theme/accessibility/adaptivePreference'
import type {SettingsIconDomain, SystemAdaptivePreference} from '@/theme/contracts'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type SettingsNavRow = {
  title: string
  description?: string
  icon?: ModulaIconName | string
  iconDomain?: SettingsIconDomain
  value?: string
  route?: string
  onPress?: () => void
  preview?: boolean
  comingSoon?: boolean
  keywords?: string[]
}

const ICON_DOMAIN: Partial<Record<ModulaIconName, SettingsIconDomain>> = {
  account: 'profile',
  profile: 'profile',
  people: 'profile',
  notifications: 'notifications',
  privacy: 'privacy',
  eye: 'privacy',
  storage: 'data',
  saved: 'data',
  bookmark: 'data',
  download: 'data',
  folder: 'data',
  appearance: 'appearance',
  palette: 'appearance',
  contrast: 'appearance',
  accessibility: 'accessibility',
  motion: 'accessibility',
  text: 'language',
  community: 'language',
  modules: 'modules',
  module: 'modules',
  marketplace: 'modules',
  board: 'modules',
  update: 'modules',
  security: 'security',
  key: 'security',
  warning: 'security',
  developer: 'developer',
  settings: 'developer',
  photo: 'content',
  image: 'content',
  camera: 'content',
  filter: 'content',
  integrations: 'connections',
  link: 'connections',
  info: 'info',
  mail: 'info',
  clock: 'info',
  switch: 'account',
}

export function settingsIconName(icon?: string): ModulaIconName | undefined {
  if (!icon) return undefined
  return icon in MODULA_ICONS ? (icon as ModulaIconName) : 'settings'
}

export function settingsIconDomain(
  icon?: ModulaIconName,
  domain?: SettingsIconDomain,
): SettingsIconDomain {
  return domain ?? (icon ? ICON_DOMAIN[icon] : undefined) ?? 'info'
}

export function matchesSettingsQuery(row: SettingsNavRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    row.title,
    row.description ?? '',
    row.value ?? '',
    ...(row.keywords ?? []),
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
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
    <View role="main" style={[styles.screen, {backgroundColor: colours.canvas}]}>
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
    <AppText variant="footnote" colour="textSecondary">
      {children}
    </AppText>
  )
}

export function SettingsHero({
  icon,
  iconDomain,
  title,
  body,
}: {
  icon: ModulaIconName
  iconDomain?: SettingsIconDomain
  title: string
  body: string
}) {
  const {colours, controls, spacing, radius, settingsIcons} = useThemeTokens()
  const domain = settingsIconDomain(icon, iconDomain)
  const token = settingsIcons[domain]

  return (
    <View
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${title}. ${body}`}
      style={[
        styles.hero,
        {
          backgroundColor: colours.surface,
          borderRadius: radius.medium,
          gap: spacing[3],
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
        },
      ]}>
      <View
        accessible={false}
        importantForAccessibility="no"
        style={[
          styles.heroTile,
          {
            backgroundColor: token.background,
            borderRadius: radius.round,
            height: controls.iconButton.regular,
            width: controls.iconButton.regular,
          },
        ]}>
        <ModulaIcon name={icon} size={controls.iconSize.row} colour={token.foreground} />
      </View>
      <View style={styles.heroCopy}>
        <AppText variant="headline">{title}</AppText>
        <AppText variant="caption" colour="textSecondary">{body}</AppText>
      </View>
    </View>
  )
}

export function SettingsFooter({children}: {children: ReactNode}) {
  const {spacing} = useThemeTokens()
  return (
    <AppText
      variant="footnote"
      colour="textSecondary"
      style={{paddingHorizontal: spacing[4]}}>
      {children}
    </AppText>
  )
}

export function SettingsIconTile({
  name,
  domain,
}: {
  name: ModulaIconName
  domain?: SettingsIconDomain
}) {
  return <ModulaIconTile icon={name} tone={settingsIconDomain(name, domain)} />
}

export function SettingsSection({
  title,
  footer,
  children,
}: {
  title?: string
  footer?: string
  children: ReactNode
}) {
  return <ModulaListSection title={title} footer={footer}>{children}</ModulaListSection>
}

export function SettingsLinkRow({
  row,
  last,
}: {
  row: SettingsNavRow
  last?: boolean
}) {
  const router = useRouter()
  const title = row.comingSoon
    ? row.title
    : row.preview
      ? `${row.title} — Preview`
      : row.title
  const value = row.comingSoon ? row.value ?? 'Coming Soon' : row.value
  const accessibilityLabel = row.comingSoon
    ? `${row.title}, Coming Soon`
    : [title, value].filter(Boolean).join(', ')

  return (
    <ModulaListRow
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={row.comingSoon ? {disabled: true} : undefined}
      accessory={row.comingSoon ? 'none' : 'chevron'}
      description={row.description}
      disabled={row.comingSoon}
      last={last}
      leading={
        row.icon ? (
          <SettingsIconTile
            name={settingsIconName(row.icon) ?? 'settings'}
            domain={row.iconDomain}
          />
        ) : undefined
      }
      metadata={value}
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
      title={title}
      variant="navigation"
    />
  )
}

export function SettingsInfoRow({
  icon,
  iconDomain,
  label,
  value,
  description,
  last,
}: {
  icon?: ModulaIconName
  iconDomain?: SettingsIconDomain
  label: string
  value?: string
  description?: string
  last?: boolean
}) {
  return (
    <ModulaListRow
      description={description}
      last={last}
      leading={icon ? <SettingsIconTile name={icon} domain={iconDomain} /> : undefined}
      metadata={value}
      title={label}
      variant="value"
    />
  )
}

export function SettingsChoiceRow({
  label,
  selected,
  onPress,
  last,
}: {
  label: string
  selected: boolean
  onPress: () => void
  last?: boolean
}) {
  return (
    <ModulaListRow
      accessory="check"
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{selected}}
      last={last}
      onPress={onPress}
      selected={selected}
      title={label}
      variant="action"
    />
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
  const {accessibility, spacing} = useThemeTokens()
  const title = preview ? `${label} — Preview` : label

  return (
    <ModulaListRow
      description={description}
      last={last}
      title={title}
      trailing={
        <View style={[styles.toggleAccessory, {gap: spacing[2]}]}>
          {accessibility.showSwitchLabels ? (
            <AppText variant="micro" colour={value ? 'accent' : 'textSecondary'}>
              {value ? 'On' : 'Off'}
            </AppText>
          ) : null}
          <SystemSwitch value={value} onValueChange={onValueChange} label={title} />
        </View>
      }
      variant="toggle"
    />
  )
}

export function SettingsAdaptiveRow({
  label,
  description,
  value,
  onValueChange,
  last,
  icon,
  iconDomain,
}: {
  label: string
  description?: string
  value: SystemAdaptivePreference
  onValueChange: (next: SystemAdaptivePreference) => void
  last?: boolean
  icon?: ModulaIconName
  iconDomain?: SettingsIconDomain
}) {
  return (
    <SettingsMenuRow
      label={label}
      description={description}
      value={adaptivePreferenceLabel(value)}
      menuTitle={label}
      icon={icon}
      iconDomain={iconDomain}
      actions={SYSTEM_ADAPTIVE_OPTIONS.map(option => ({
        id: option.value,
        label: option.label,
      }))}
      onAction={id => {
        if (id === 'system' || id === 'on' || id === 'off') {
          onValueChange(id)
        }
      }}
      last={last}
    />
  )
}

export function SettingsMenuRow({
  label,
  description,
  value,
  actions,
  onAction,
  last,
  preview,
  menuTitle,
  icon,
  iconDomain,
}: {
  label: string
  description?: string
  value?: string
  actions: ModulaActionItem[]
  onAction: (id: string) => void
  last?: boolean
  preview?: boolean
  menuTitle?: string
  icon?: ModulaIconName
  iconDomain?: SettingsIconDomain
}) {
  const title = preview ? `${label} — Preview` : label

  return (
    <ModulaMenu
      title={menuTitle ?? label}
      actions={actions}
      onAction={onAction}
      accessibilityLabel={`${title}${value ? `, ${value}` : ''}`}
      trigger={
        <ModulaListRow
          accessory="chevron"
          description={description}
          last={last}
          leading={icon ? <SettingsIconTile name={icon} domain={iconDomain} /> : undefined}
          metadata={value}
          title={title}
          variant="navigation"
        />
      }
    />
  )
}

export function SettingsDestructiveRow({
  label,
  description,
  onPress,
  last,
}: {
  label: string
  description?: string
  onPress: () => void
  last?: boolean
}) {
  return (
    <ModulaListRow
      description={description}
      last={last}
      onPress={onPress}
      title={label}
      variant="destructive"
    />
  )
}

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
    <ChromeGlassControlGroup
      items={[
        {
          kind: 'menu',
          icon: 'more',
          accessibilityLabel: 'More settings actions',
          title,
          actions,
          onAction,
        },
      ]}
    />
  )
}

/**
 * @deprecated Prefer SettingsCaption — header already owns the screen title.
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
  hero: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  heroCopy: {flex: 1, gap: 2, minWidth: 0},
  heroTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  screen: {
    flex: 1,
  },
  toggleAccessory: {
    alignItems: 'center',
    flexDirection: 'row',
  },
})
