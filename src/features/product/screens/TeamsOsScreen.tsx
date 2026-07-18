import {useState} from 'react'
import {Pressable, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ROLES = [
  {id: 'owner', label: 'Owner', desc: 'Full org control'},
  {id: 'admin', label: 'Admin', desc: 'Manage members & modules'},
  {id: 'editor', label: 'Editor', desc: 'Edit shared Board & content'},
  {id: 'member', label: 'Member', desc: 'Post & collaborate'},
  {id: 'guest', label: 'Guest', desc: 'View limited surfaces'},
] as const

const SHARED = [
  {label: 'Shared Board widgets', href: '/product/widgets' as Href},
  {label: 'Team CRM', href: '/marketplace/module-crm' as Href},
  {label: 'Collaborative tasks', href: '/marketplace/module-tasks' as Href},
  {label: 'Shared files & calendar', href: '/marketplace/module-calendar' as Href},
  {label: 'Organisation posts', href: '/communities' as Href},
  {label: 'Approval workflows', href: '/product/automations' as Href},
]

export function TeamsOsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const [activeRole, setActiveRole] = useState<(typeof ROLES)[number]['id']>('admin')
  const role = ROLES.find(r => r.id === activeRole) ?? ROLES[1]

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Teams" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4]}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Shared profiles with roles.</AppText>
            <AppText variant="body" colour="textSecondary">
              Teams reuse Profile-OS — not a disconnected second product. Preview surfaces only.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[2],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="caption" colour="textTertiary">
              PREVIEW AS
            </AppText>
            <AppText variant="title">{role.label}</AppText>
            <AppText variant="body" colour="textSecondary">
              {role.desc}
            </AppText>
          </Surface>

          <View style={[styles.roles, {gap: spacing[2]}]}>
            {ROLES.map(item => {
              const on = item.id === activeRole
              return (
                <Pressable key={item.id} onPress={() => setActiveRole(item.id)}>
                  <Surface
                    variant="contained"
                    style={[
                      styles.role,
                      {
                        paddingHorizontal: spacing[3],
                        paddingVertical: spacing[2],
                        borderRadius: radius.round,
                        backgroundColor: on ? colours.accentSubtle : colours.surface,
                        borderColor: on ? colours.accent : colours.border,
                      },
                    ]}>
                    <AppText variant="caption" colour={on ? 'accent' : 'text'}>
                      {item.label}
                    </AppText>
                  </Surface>
                </Pressable>
              )
            })}
          </View>

          <View style={{gap: spacing[3]}}>
            {SHARED.map(item => (
              <Pressable key={item.label} onPress={() => router.push(item.href)}>
                <Surface
                  variant="contained"
                  style={[
                    styles.row,
                    {
                      padding: spacing[4],
                      gap: spacing[2],
                      borderRadius: radius.medium,
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppIcon name="teams" colour={colours.accent} size={18} />
                  <AppText variant="body" style={{flex: 1}}>
                    {item.label}
                  </AppText>
                  <AppIcon name="chevronRight" colour={colours.textTertiary} size={16} />
                </Surface>
              </Pressable>
            ))}
          </View>

          <AppButton onPress={() => router.push('/product/teams' as Href)}>
            Teams capability card
          </AppButton>
          <AppButton variant="secondary" onPress={() => router.push('/product' as Href)}>
            All capabilities
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  roles: {flexDirection: 'row', flexWrap: 'wrap'},
  role: {borderWidth: StyleSheet.hairlineWidth},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
})
