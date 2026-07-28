import {useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {
  MODULE_PERMISSION_CATALOGUE,
  RISK_LABEL,
  runPermissionsSecurityScan,
  type PermissionRisk,
} from '@/features/product/data/modulePermissions'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const FILTERS: ('all' | PermissionRisk)[] = ['all', 'low', 'medium', 'high']

export function PermissionsMatrixScreen() {
  const router = useRouter()
  const {colours, radius, spacing, scheme} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('all')
  const [selected, setSelected] = useState<string[]>([
    'storage:namespaced',
    'profile:read',
    'board:write',
  ])

  const wash =
    scheme === 'dark'
      ? ['#0B1416', colours.accentSubtle]
      : [colours.accentSubtle, colours.canvas]

  const rows = useMemo(
    () =>
      MODULE_PERMISSION_CATALOGUE.filter(item => filter === 'all' || item.risk === filter),
    [filter],
  )
  const scan = useMemo(() => runPermissionsSecurityScan(selected), [selected])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Permissions" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <LinearGradient
            colors={wash as [string, string]}
            style={[
              styles.hero,
              {
                borderRadius: radius.large,
                padding: spacing[5],
                gap: spacing[2],
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="accent">
              MODULE STANDARD · LEAST PRIVILEGE
            </AppText>
            <AppText variant="display">Permissions users can understand.</AppText>
            <AppText variant="body" colour="textSecondary">
              Every module declares permissions in the manifest. Host enforces; users see plain
              language. Security Scan Preview mirrors Base44-style confidence without inventing CVEs.
            </AppText>
          </LinearGradient>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={[styles.filters, {gap: spacing[2]}]}>
              {FILTERS.map(item => {
                const on = filter === item
                return (
                  <AppPressable
                    key={item}
                    onPress={() => setFilter(item)}
                    style={[
                      styles.filter,
                      {
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        borderRadius: radius.round,
                        backgroundColor: on ? colours.accentSubtle : colours.surface,
                        borderColor: on ? colours.accent : colours.border,
                      },
                    ]}>
                    <AppText variant="caption" colour={on ? 'accent' : 'text'}>
                      {item === 'all' ? 'All' : RISK_LABEL[item]}
                    </AppText>
                  </AppPressable>
                )
              })}
            </View>
          </ScrollView>

          <View style={{gap: spacing[3]}}>
            {rows.map(perm => {
              const on = selected.includes(perm.id)
              return (
                <AppPressable
                  key={perm.id}
                  accessibilityLabel={perm.label}
                  onPress={() =>
                    setSelected(prev =>
                      on ? prev.filter(id => id !== perm.id) : [...prev, perm.id],
                    )
                  }>
                  <Surface
                    variant="contained"
                    style={[
                      styles.row,
                      {
                        padding: spacing[4],
                        gap: spacing[3],
                        borderRadius: radius.large,
                        backgroundColor: on ? colours.accentSubtle : colours.surface,
                        borderColor: on ? colours.accent : colours.border,
                      },
                    ]}>
                    <AppIcon
                      name={perm.risk === 'high' ? 'warning' : 'security'}
                      colour={colours.accent}
                    />
                    <View style={{flex: 1, gap: spacing[1]}}>
                      <AppText variant="headline">{perm.label}</AppText>
                      <AppText variant="caption" colour="accent">
                        {perm.userVisible}
                      </AppText>
                      <AppText variant="body" colour="textSecondary">
                        {perm.description}
                      </AppText>
                      <AppText variant="caption" colour="textTertiary">
                        {perm.id} · {RISK_LABEL[perm.risk]}
                      </AppText>
                    </View>
                  </Surface>
                </AppPressable>
              )
            })}
          </View>

          <AppText variant="headline">Security Scan · Preview</AppText>
          {scan.map(finding => (
            <Surface
              key={finding.id}
              variant="contained"
              style={[
                styles.finding,
                {
                  padding: spacing[4],
                  gap: spacing[2],
                  borderRadius: radius.medium,
                  backgroundColor: colours.surfaceRaised,
                  borderColor: colours.border,
                },
              ]}>
              <AppText variant="caption" colour="accent">
                {RISK_LABEL[finding.severity]}
              </AppText>
              <AppText variant="headline">{finding.title}</AppText>
              <AppText variant="body" colour="textSecondary">
                {finding.body}
              </AppText>
            </Surface>
          ))}

          <AppButton onPress={() => router.push('/product/forge' as Href)}>Apply in Forge</AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product/module-standards' as Href)}>
            Module standards
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product/sandbox' as Href)}>
            Sandbox foreshadow
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  hero: {borderWidth: StyleSheet.hairlineWidth, width: '100%'},
  filters: {flexDirection: 'row'},
  filter: {borderWidth: StyleSheet.hairlineWidth},
  row: {
    alignItems: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  finding: {borderWidth: StyleSheet.hairlineWidth},
})
