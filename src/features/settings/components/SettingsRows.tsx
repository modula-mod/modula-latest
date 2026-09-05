import type {ReactNode} from 'react'
import {Platform, ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native'
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
  const {controls, settingsIcons} = useThemeTokens()
  const token = settingsIcons[settingsIconDomain(name, domain)]
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[
        styles.iconTile,
        {
          backgroundColor: token.background,
          height: controls.iconTile.small,
          width: controls.iconTile.small,
        },
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
  const {colours, spacing, radius} = useThemeTokens()

  return (
    <View style={{gap: spacing[2]}}>
      {title ? (
        <AppText
          variant="sectionHeader"
          colour="textSecondary"
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
            borderRadius: radius.medium,
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
  leading,
}: {
  last?: boolean
  stacked?: boolean
  leading?: ReactNode
  children: ReactNode
}) {
  const {colours, controls, spacing} = useThemeTokens()
  return (
    <View style={[styles.row, {minHeight: controls.listRow.minimum, paddingLeft: spacing[4]}]}>
      {leading}
      <View
        style={[
          stacked ? styles.rowBodyStacked : styles.rowBody,
          {
            borderBottomColor: last ? 'transparent' : colours.separator,
            marginLeft: leading ? spacing[3] : 0,
            paddingRight: spacing[4],
            paddingVertical: spacing[3],
            gap: spacing[3],
            minHeight: controls.listRow.minimum,
          },
        ]}>
        {children}
      </View>
    </View>
  )
}

function TrailingValue({value}: {value: string}) {
  return (
    <AppText
      variant="rowTrailing"
      colour="textSecondary"
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
      <RowChrome
        last={last}
        stacked={stacked}
        leading={
          row.icon ? (
            <SettingsIconTile
              name={settingsIconName(row.icon) ?? 'settings'}
              domain={row.iconDomain}
            />
          ) : undefined
        }>
        <View style={styles.rowText}>
          <AppText variant="rowTitle">{title}</AppText>
          {row.description ? (
            <AppText variant="caption" colour="textSecondary">
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
      accessible={Platform.OS === 'web' ? undefined : true}
      accessibilityRole={Platform.OS === 'web' ? undefined : 'text'}
      accessibilityLabel={
        Platform.OS === 'web'
          ? undefined
          : [label, value, description].filter(Boolean).join(', ')
      }>
      <RowChrome
        last={last}
        stacked={stacked}
        leading={icon ? <SettingsIconTile name={icon} domain={iconDomain} /> : undefined}>
        <View style={styles.rowText}>
          <AppText variant="rowTitle">{label}</AppText>
          {description ? (
            <AppText variant="caption" colour="textSecondary">
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
  const {colours} = useThemeTokens()
  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityRole="radio"
      accessibilityState={{selected}}
      onPress={onPress}>
      <RowChrome last={last}>
        <View style={styles.rowText}>
          <AppText variant="rowTitle">{label}</AppText>
        </View>
        {selected ? (
          <View accessible={false} importantForAccessibility="no">
            <ModulaIcon name="check" size={18} colour={colours.accent} />
          </View>
        ) : null}
      </RowChrome>
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
        <AppText variant="micro" colour={value ? 'accent' : 'textSecondary'}>
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
        <RowChrome
          last={last}
          stacked={stacked}
          leading={icon ? <SettingsIconTile name={icon} domain={iconDomain} /> : undefined}>
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
            <AppText variant="caption" colour="textSecondary">
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
    alignItems: 'center',
    flexDirection: 'row',
  },
  heroCopy: {flex: 1, gap: 2, minWidth: 0},
  heroTile: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconTile: {
    alignItems: 'center',
    borderRadius: 7,
    justifyContent: 'center',
  },
  list: {
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    width: '100%',
  },
  rowBody: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
  },
  rowBodyStacked: {
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
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
