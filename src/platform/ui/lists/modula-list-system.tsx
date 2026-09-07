import type {ReactNode} from 'react'
import {
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type AccessibilityRole,
  type AccessibilityState,
  type StyleProp,
  type ViewStyle,
} from 'react-native'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {Avatar} from '@/components/primitives/Avatar'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {ModulaIcon} from '@/platform/ui/icons/modula-icon'
import type {ModulaIconName} from '@/platform/ui/icons/modula-icon-registry'
import type {SettingsIconDomain} from '@/theme/contracts'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

export type ModulaListRowVariant =
  | 'navigation'
  | 'toggle'
  | 'value'
  | 'action'
  | 'person'
  | 'product'
  | 'notification'
  | 'destructive'

export type ModulaListAccessory = 'none' | 'chevron' | 'check'

export type ModulaListProps = {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}

export type ModulaListSectionProps = {
  title?: string
  footer?: string
  children: ReactNode
  style?: StyleProp<ViewStyle>
  testID?: string
}

export type ModulaListRowProps = {
  title?: string
  description?: string
  metadata?: string
  leading?: ReactNode
  trailing?: ReactNode
  children?: ReactNode
  variant?: ModulaListRowVariant
  accessory?: ModulaListAccessory | ReactNode
  onPress?: () => void
  disabled?: boolean
  selected?: boolean
  last?: boolean
  compact?: boolean
  /** Force a wrapped row layout, for large text or rich local composition. */
  stacked?: boolean
  accessibilityLabel?: string
  accessibilityRole?: AccessibilityRole
  accessibilityState?: AccessibilityState
  style?: StyleProp<ViewStyle>
  testID?: string
}

export function ModulaList({children, style, testID}: ModulaListProps) {
  const {radius} = useThemeTokens()
  return (
    <MaterialSurface
      role="card"
      testID={testID}
      style={[styles.list, {borderRadius: radius.medium}, style]}>
      {children}
    </MaterialSurface>
  )
}

export function ModulaListSection({
  title,
  footer,
  children,
  style,
  testID,
}: ModulaListSectionProps) {
  const {spacing} = useThemeTokens()
  return (
    <View testID={testID} style={[styles.section, {gap: spacing[2]}, style]}>
      {title ? (
        <AppText
          variant="sectionHeader"
          colour="textSecondary"
          style={[styles.sectionTitle, {paddingHorizontal: spacing[4]}]}>
          {title}
        </AppText>
      ) : null}
      <ModulaList>{children}</ModulaList>
      {footer ? (
        <AppText
          variant="footnote"
          colour="textSecondary"
          style={{paddingHorizontal: spacing[4]}}>
          {footer}
        </AppText>
      ) : null}
    </View>
  )
}

export function ModulaListRow({
  title,
  description,
  metadata,
  leading,
  trailing,
  children,
  variant = 'value',
  accessory = variant === 'navigation' ? 'chevron' : 'none',
  onPress,
  disabled,
  selected,
  last,
  compact,
  stacked: forceStacked,
  accessibilityLabel,
  accessibilityRole,
  accessibilityState,
  style,
  testID,
}: ModulaListRowProps) {
  const {fontScale} = useWindowDimensions()
  const {colours, controls, spacing} = useThemeTokens()
  const stacked = forceStacked ?? (fontScale >= 1.6 && Boolean(metadata || trailing))
  const destructive = variant === 'destructive'
  const computedLabel = accessibilityLabel ?? [title, description, metadata].filter(Boolean).join(', ')
  const state = {...accessibilityState, disabled: Boolean(disabled), selected}
  const content = (
    <View
      style={[
        styles.row,
        {
          minHeight: compact ? controls.listRow.compact : controls.listRow.minimum,
          paddingLeft: spacing[4],
        },
        style,
      ]}>
      {leading}
      <View
        style={[
          styles.rowBody,
          stacked ? styles.rowBodyStacked : null,
          {
            borderBottomColor: last ? 'transparent' : colours.separator,
            gap: spacing[3],
            marginLeft: leading ? spacing[3] : 0,
            minHeight: compact ? controls.listRow.compact : controls.listRow.minimum,
            paddingRight: spacing[4],
            paddingVertical: compact ? spacing[2] : spacing[3],
          },
        ]}>
        {children ?? (
          <View style={styles.copy}>
            {title ? (
              <AppText
                variant="rowTitle"
                style={{color: destructive ? colours.destructive : colours.text}}>
                {title}
              </AppText>
            ) : null}
            {description ? (
              <AppText variant="caption" colour="textSecondary">
                {description}
              </AppText>
            ) : null}
            {stacked && metadata ? <ModulaListMetadata>{metadata}</ModulaListMetadata> : null}
          </View>
        )}
        {!stacked && metadata ? <ModulaListMetadata>{metadata}</ModulaListMetadata> : null}
        {trailing}
        <ModulaListAccessoryView accessory={accessory} selected={selected} />
      </View>
    </View>
  )

  if (!onPress) {
    return (
      <View
        accessible={Platform.OS === 'web' ? undefined : Boolean(computedLabel)}
        accessibilityLabel={Platform.OS === 'web' ? undefined : computedLabel || undefined}
        accessibilityRole={accessibilityRole}
        accessibilityState={state}
        testID={testID}>
        {content}
      </View>
    )
  }

  return (
    <AppPressable
      aria-checked={accessibilityRole === 'radio' ? Boolean(accessibilityState?.checked) : undefined}
      accessibilityLabel={computedLabel || undefined}
      accessibilityRole={accessibilityRole ?? (variant === 'navigation' ? 'link' : 'button')}
      accessibilityState={state}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={styles.pressable}>
      {content}
    </AppPressable>
  )
}

export const ModulaActivityRow = (
  props: Omit<ModulaListRowProps, 'variant'>,
) => <ModulaListRow {...props} variant="notification" />

export const ModulaNotificationRow = (
  props: Omit<ModulaListRowProps, 'variant'>,
) => <ModulaListRow {...props} variant="notification" />

export function ModulaListMetadata({children}: {children: ReactNode}) {
  return (
    <AppText variant="rowTrailing" colour="textSecondary" style={styles.metadata}>
      {children}
    </AppText>
  )
}

export function ModulaListAccessoryView({
  accessory,
  selected,
}: {
  accessory: ModulaListAccessory | ReactNode
  selected?: boolean
}) {
  const {colours} = useThemeTokens()
  if (accessory === 'none' || accessory === null || accessory === undefined) return null
  if (accessory === 'chevron') {
    return (
      <View accessible={false} importantForAccessibility="no">
        <ModulaIcon name="chevronRight" size={16} colour={colours.textTertiary} />
      </View>
    )
  }
  if (accessory === 'check') {
    return selected ? (
      <View accessible={false} importantForAccessibility="no">
        <ModulaIcon name="check" size={18} colour={colours.accent} />
      </View>
    ) : null
  }
  return <>{accessory}</>
}

export function ModulaIconTile({
  icon,
  tone = 'info',
  size,
}: {
  icon: ModulaIconName
  tone?: SettingsIconDomain
  size?: number
}) {
  const {controls, radius, settingsIcons} = useThemeTokens()
  const edge = size ?? controls.iconTile.small
  const token = settingsIcons[tone]
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={[
        styles.iconTile,
        {
          backgroundColor: token.background,
          borderRadius: radius.small,
          height: edge,
          width: edge,
        },
      ]}>
      <ModulaIcon name={icon} size={Math.min(18, edge - 12)} colour={token.foreground} />
    </View>
  )
}

export function ModulaListAvatar({
  name,
  uri,
  colour,
  size = 40,
  presence,
}: {
  name: string
  uri?: string
  colour?: string
  size?: number
  presence?: boolean
}) {
  const {colours} = useThemeTokens()
  return (
    <View>
      <Avatar name={name} uri={uri} colour={colour} size={size} />
      {presence ? (
        <View
          accessibilityLabel="Online"
          style={[
            styles.presence,
            {backgroundColor: colours.success, borderColor: colours.surface},
          ]}
        />
      ) : null}
    </View>
  )
}

export function ModulaSeparator({
  inset = false,
  section = false,
  style,
}: {
  inset?: boolean
  section?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const {colours, spacing} = useThemeTokens()
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.separator,
        {
          backgroundColor: colours.separator,
          height: section ? 1 : StyleSheet.hairlineWidth,
          marginLeft: inset ? spacing[4] : 0,
          marginVertical: section ? spacing[3] : 0,
        },
        style,
      ]}
    />
  )
}

export const ModulaInsetSeparator = (props: Omit<Parameters<typeof ModulaSeparator>[0], 'inset'>) => (
  <ModulaSeparator {...props} inset />
)

export const ModulaSectionSeparator = (props: Omit<Parameters<typeof ModulaSeparator>[0], 'section'>) => (
  <ModulaSeparator {...props} section />
)

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    minWidth: 0,
  },
  iconTile: {
    alignItems: 'center',
    flexShrink: 0,
    justifyContent: 'center',
  },
  list: {
    alignSelf: 'stretch',
    overflow: 'hidden',
  },
  metadata: {
    flexShrink: 1,
    maxWidth: 160,
    textAlign: 'right',
  },
  presence: {
    borderRadius: 5,
    borderWidth: 2,
    bottom: 0,
    height: 10,
    position: 'absolute',
    right: 0,
    width: 10,
  },
  pressable: {
    alignSelf: 'stretch',
    width: '100%',
  },
  row: {
    alignItems: 'stretch',
    flexDirection: 'row',
    width: '100%',
  },
  rowBody: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  rowBodyStacked: {
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  section: {
    alignSelf: 'stretch',
  },
  sectionTitle: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  separator: {
    alignSelf: 'stretch',
  },
})
