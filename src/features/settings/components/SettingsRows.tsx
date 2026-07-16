import {StyleSheet, Switch, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {MaterialSurface} from '@/components/materials/MaterialSurface'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
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

export function SettingsSection({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
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
        <AppText variant="headline">{title}</AppText>
        {row.description ? (
          <AppText variant="caption" colour="textSub">
            {row.description}
          </AppText>
        ) : null}
      </View>
      {row.value ? (
        <AppText variant="caption" colour="textMuted" numberOfLines={1}>
          {row.value}
        </AppText>
      ) : null}
      <AppIcon name="chevronRight" colour={colours.textMuted} size={18} />
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
        <AppText variant="headline">{title}</AppText>
        {description ? (
          <AppText variant="caption" colour="textSub">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={title}
        trackColor={{false: colours.border, true: colours.accent}}
      />
    </View>
  )
}

export function SettingsInfoBlock({
  title,
  body,
}: {
  title: string
  body: string
}) {
  const {spacing} = useThemeTokens()
  return (
    <View style={{gap: spacing[2]}}>
      <AppText variant="display">{title}</AppText>
      <AppText variant="body" colour="textSub">
        {body}
      </AppText>
    </View>
  )
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  list: {
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    minHeight: 56,
  },
  rowText: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
})
