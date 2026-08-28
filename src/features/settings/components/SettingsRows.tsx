import type {ReactNode} from 'react'
import {ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {SystemSwitch} from '@/components/system/SystemSwitch'
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
    <AppText variant="footnote" colour="textTertiary">
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
  const {colours, spacing, radius, settingsIcons} = useThemeTokens()
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
          borderColor: colours.separator,
          borderRadius: radius.large,
          gap: spacing[3],
          padding: spacing[4],
        },
      ]}>
      <View
        accessible={false}
        importantForAccessibility="no"
        style={[
          styles.heroTile,
          {backgroundColor: token.background, borderRadius: radius.medium},
        ]}>
        <ModulaIcon name={icon} size={28} colour={token.foreground} />
      </View>
      <AppText variant="heroTitle">{title}</AppText>
      <AppText variant="heroDescription" colour="textSecondary">
        {body}
      </AppText>
    </View>
  )
}

export function SettingsFooter({children}: {children: ReactNode}) {
  const {spacing} = useThemeTokens()
  return (
    <AppText
      variant="footnote"
      colour="textTertiary"
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
  const {settingsIcons, radius} = useThemeTokens()
  const token = settingsIcons[settingsIconDomain(name, domain)]
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[
        styles.iconTile,
        {backgroundColor: token.background, borderRadius: radius.small},
      ]}>
      <ModulaIcon name={name} size={16} colour={token.foreground} />
    </View>
  )
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
  const {colours, spacing, radius, accessibility} = useThemeTokens()
  const groupedSurface =
    accessibility.reduceTransparency || accessibility.increaseContrast
      ? colours.surface
      : colours.surface

  return (
    <View style={{gap: spacing[2]}}>
      {title ? (
        <AppText
          variant="sectionHeader"
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
            backgroundColor: groupedSurface,
            borderColor: colours.separator,
            borderRadius: radius.large,
          },
        ]}>
        {children}
      </View>
      {footer ? <SettingsFooter>{footer}</SettingsFooter> : null}
    </View>
  )
}

function RowChrome({
  last,
  children,
  stacked,
}: {
  last?: boolean
  stacked?: boolean
  children: ReactNode
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View
      style={[
        stacked ? styles.rowStacked : styles.row,
        {
          borderBottomColor: last ? 'transparent' : colours.separator,
          paddingHorizontal: spacing[4],
          paddingVertical: spacing[3],
          gap: spacing[3],
        },
      ]}>
      {children}
    </View>
  )
}

function TrailingValue({value}: {value: string}) {
  return (
    <AppText
      variant="rowTrailing"
      colour="textTertiary"
      style={styles.trailing}>
      {value}
    </AppText>
  )
}

function DecorativeChevron() {
  const {colours} = useThemeTokens()
  return (
    <View accessible={false} importantForAccessibility="no">
      <ModulaIcon name="chevronRight" size={16} colour={colours.textTertiary} />
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
  const {fontScale} = useWindowDimensions()
  const stacked = fontScale >= 1.6
  const title = row.comingSoon
    ? row.title
    : row.preview
      ? `${row.title} — Preview`
      : row.title
  const value = row.comingSoon ? row.value ?? 'Coming Soon' : row.value
  const accessibilityLabel = [
    row.comingSoon ? `${row.title}, Coming Soon` : title,
    value,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <AppPressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
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
      }}>
      <RowChrome last={last} stacked={stacked}>
        {row.icon ? (
          <SettingsIconTile
            name={settingsIconName(row.icon) ?? 'settings'}
            domain={row.iconDomain}
          />
        ) : null}
        <View style={styles.rowText}>
          <AppText variant="rowTitle">{title}</AppText>
          {row.description ? (
            <AppText variant="caption" colour="textTertiary">
              {row.description}
            </AppText>
          ) : null}
          {stacked && value ? <TrailingValue value={value} /> : null}
        </View>
        {!stacked && value ? <TrailingValue value={value} /> : null}
        {row.comingSoon ? null : <DecorativeChevron />}
      </RowChrome>
    </AppPressable>
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
  const {fontScale} = useWindowDimensions()
  const stacked = fontScale >= 1.6
  return (
    <View
      accessible
      accessibilityRole="text"
      accessibilityLabel={[label, value, description].filter(Boolean).join(', ')}>
      <RowChrome last={last} stacked={stacked}>
        {icon ? <SettingsIconTile name={icon} domain={iconDomain} /> : null}
        <View style={styles.rowText}>
          <AppText variant="rowTitle">{label}</AppText>
          {description ? (
            <AppText variant="caption" colour="textTertiary">
              {description}
            </AppText>
          ) : null}
          {stacked && value ? <TrailingValue value={value} /> : null}
        </View>
        {!stacked && value ? <TrailingValue value={value} /> : null}
      </RowChrome>
    </View>
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
  const {accessibility} = useThemeTokens()
  const title = preview ? `${label} — Preview` : label

  return (
    <RowChrome last={last}>
      <View style={styles.rowText}>
        <AppText variant="rowTitle">{title}</AppText>
        {description ? (
          <AppText variant="caption" colour="textSecondary">
            {description}
          </AppText>
        ) : null}
      </View>
      {accessibility.showSwitchLabels ? (
        <AppText variant="micro" colour={value ? 'accent' : 'textTertiary'}>
          {value ? 'On' : 'Off'}
        </AppText>
      ) : null}
      <SystemSwitch value={value} onValueChange={onValueChange} label={title} />
    </RowChrome>
  )
}

export function SettingsAdaptiveRow({
  label,
  description,
  value,
  onValueChange,
  last,
}: {
  label: string
  description?: string
  value: SystemAdaptivePreference
  onValueChange: (next: SystemAdaptivePreference) => void
  last?: boolean
}) {
  return (
    <SettingsMenuRow
      label={label}
      description={description}
      value={adaptivePreferenceLabel(value)}
      menuTitle={label}
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
  const {fontScale} = useWindowDimensions()
  const stacked = fontScale >= 1.6
  const title = preview ? `${label} — Preview` : label

  return (
    <ModulaMenu
      title={menuTitle ?? label}
      actions={actions}
      onAction={onAction}
      accessibilityLabel={`${title}${value ? `, ${value}` : ''}`}
      trigger={
        <RowChrome last={last} stacked={stacked}>
          {icon ? <SettingsIconTile name={icon} domain={iconDomain} /> : null}
          <View style={styles.rowText}>
            <AppText variant="rowTitle">{title}</AppText>
            {description ? (
              <AppText variant="caption" colour="textSecondary">
                {description}
              </AppText>
            ) : null}
            {stacked && value ? <TrailingValue value={value} /> : null}
          </View>
          {!stacked && value ? <TrailingValue value={value} /> : null}
          <DecorativeChevron />
        </RowChrome>
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
  const {colours} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={onPress}>
      <RowChrome last={last}>
        <View style={styles.rowText}>
          <AppText variant="rowTitle" style={{color: colours.destructive}}>
            {label}
          </AppText>
          {description ? (
            <AppText variant="caption" colour="textTertiary">
              {description}
            </AppText>
          ) : null}
        </View>
      </RowChrome>
    </AppPressable>
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
    borderWidth: StyleSheet.hairlineWidth,
  },
  heroTile: {
    alignItems: 'center',
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  iconTile: {
    alignItems: 'center',
    height: 30,
    justifyContent: 'center',
    width: 30,
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
  rowStacked: {
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 52,
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
  trailing: {
    flexShrink: 1,
    maxWidth: '42%',
    textAlign: 'right',
  },
})
