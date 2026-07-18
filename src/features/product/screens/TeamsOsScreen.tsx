import {Pressable, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ROLES = [
  {
    id: 'owner',
    label: 'Owner',
    desc: 'Full org control',
    permissions: ['Billing future', 'Roles', 'Module approvals', 'Ledger view'],
  },
  {
    id: 'admin',
    label: 'Admin',
    desc: 'Manage members & modules',
    permissions: ['Roles', 'Board layout', 'Module approvals', 'Automations'],
  },
  {
    id: 'editor',
    label: 'Editor',
    desc: 'Edit shared Board & content',
    permissions: ['Posts', 'Board widgets', 'Files preview', 'Tasks'],
  },
  {
    id: 'member',
    label: 'Member',
    desc: 'Post & collaborate',
    permissions: ['Posts', 'Comments', 'Tasks', 'Availability'],
  },
  {
    id: 'guest',
    label: 'Guest',
    desc: 'View limited surfaces',
    permissions: ['Read Board', 'Read files', 'Comment with approval'],
  },
] as const

type TeamRoleId = (typeof ROLES)[number]['id']

const SHARED = [
  {
    label: 'Shared Board widgets',
    detail: 'GAIA briefing, approvals, availability, files, DIMON inactive card',
    href: '/product/widgets' as Href,
  },
  {
    label: 'Team CRM',
    detail: 'Contacts, deals, sponsor notes, and follow-up reminders',
    href: '/marketplace/module-crm' as Href,
  },
  {
    label: 'Collaborative tasks',
    detail: 'Owner/editor/member task lanes from the Tasks module',
    href: '/marketplace/module-tasks' as Href,
  },
  {
    label: 'Shared files & calendar',
    detail: 'Files and Calendar previews; no remote sync claimed',
    href: '/marketplace/module-calendar' as Href,
  },
  {
    label: 'Organisation posts',
    detail: 'Community-facing publishing with approval stubs',
    href: '/communities' as Href,
  },
  {
    label: 'Approval workflows',
    detail: 'Local workflow cards; no unattended actions run',
    href: '/product/automations' as Href,
  },
]

const APPROVALS = [
  {step: 'Draft', owner: 'Editor', state: 'Local draft'},
  {step: 'Review', owner: 'Admin', state: 'Approval stub'},
  {step: 'Verify', owner: 'AKI', state: 'Preview verification'},
  {step: 'Publish', owner: 'Owner/Admin', state: 'Manual only'},
] as const

const AVAILABILITY = [
  {label: 'Deep focus', detail: 'Quiet feed and suppress pings where Focus prefs allow.'},
  {label: 'Available', detail: 'Team can route mentions, tasks, and CRM follow-ups.'},
  {label: 'Approval needed', detail: 'Guests and risky module actions require review.'},
] as const

const LINKS = [
  {
    label: 'Intelligence Hub',
    detail: 'GAIA executes · AKI verifies · Governor controls',
    href: '/product/intelligence' as Href,
  },
  {
    label: 'Ledger Replay',
    detail: 'Inspect intended actions without mutating state',
    href: '/product/ledger' as Href,
  },
] as const

function isTeamRoleId(value: string): value is TeamRoleId {
  return ROLES.some(role => role.id === value)
}

export function TeamsOsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const {preferences, update} = useProductPreferences()
  const activeRole = isTeamRoleId(preferences.teamsRoleId) ? preferences.teamsRoleId : 'admin'
  const role = ROLES.find(r => r.id === activeRole) ?? ROLES[1]
  const focusMode =
    preferences.focus.preset === 'off'
      ? 'Focus Off'
      : `${preferences.focus.preset[0].toUpperCase()}${preferences.focus.preset.slice(1)} focus`

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
            <View style={[styles.matrix, {gap: spacing[2]}]}>
              {role.permissions.map(permission => (
                <Surface
                  key={permission}
                  variant="contained"
                  style={[
                    styles.permissionChip,
                    {
                      paddingHorizontal: spacing[3],
                      paddingVertical: spacing[2],
                      borderRadius: radius.round,
                      backgroundColor: colours.surfaceRaised,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppText variant="micro" colour="textSecondary">
                    {permission}
                  </AppText>
                </Surface>
              ))}
            </View>
          </Surface>

          <View style={[styles.roles, {gap: spacing[2]}]}>
            {ROLES.map(item => {
              const on = item.id === activeRole
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    void update({teamsRoleId: item.id})
                  }}>
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
                    <AppText variant="micro" colour="textTertiary">
                      {item.desc}
                    </AppText>
                  </Surface>
                </Pressable>
              )
            })}
          </View>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Shared Board & modules</AppText>
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
                  <View style={styles.rowBody}>
                    <AppText variant="body">{item.label}</AppText>
                    <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
                      {item.detail}
                    </AppText>
                  </View>
                  <AppIcon name="chevronRight" colour={colours.textTertiary} size={16} />
                </Surface>
              </Pressable>
            ))}
          </View>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[3],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <AppText variant="headline">Approval workflow stubs</AppText>
            {APPROVALS.map(item => (
              <View key={item.step} style={[styles.approvalRow, {gap: spacing[3]}]}>
                <View
                  style={[
                    styles.stepDot,
                    {backgroundColor: colours.accentSubtle, borderRadius: radius.round},
                  ]}>
                  <AppIcon name="check" colour={colours.accent} size={16} />
                </View>
                <View style={styles.rowBody}>
                  <AppText variant="label">{item.step}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {item.owner} · {item.state}
                  </AppText>
                </View>
              </View>
            ))}
            <AppText variant="caption" colour="textTertiary">
              Preview only: approvals are local stubs and publish remains manual.
            </AppText>
          </Surface>

          <Surface
            variant="contained"
            style={[
              styles.card,
              {
                padding: spacing[4],
                gap: spacing[3],
                borderRadius: radius.large,
                backgroundColor: colours.surface,
                borderColor: colours.border,
              },
            ]}>
            <View style={styles.sectionHeader}>
              <View style={styles.rowBody}>
                <AppText variant="headline">Focus & availability</AppText>
                <AppText variant="caption" colour="textSecondary">
                  Current preference: {focusMode}
                </AppText>
              </View>
              <AppButton variant="secondary" onPress={() => router.push('/product/focus' as Href)}>
                Focus
              </AppButton>
            </View>
            {AVAILABILITY.map(item => (
              <View key={item.label} style={{gap: spacing[1]}}>
                <AppText variant="label">{item.label}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {item.detail}
                </AppText>
              </View>
            ))}
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Intelligence & ledger</AppText>
            {LINKS.map(item => (
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
                  <AppIcon name="automation" colour={colours.accent} size={18} />
                  <View style={styles.rowBody}>
                    <AppText variant="body">{item.label}</AppText>
                    <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
                      {item.detail}
                    </AppText>
                  </View>
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
  approvalRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  card: {borderWidth: StyleSheet.hairlineWidth},
  matrix: {flexDirection: 'row', flexWrap: 'wrap'},
  permissionChip: {borderWidth: StyleSheet.hairlineWidth},
  roles: {flexDirection: 'row', flexWrap: 'wrap'},
  role: {borderWidth: StyleSheet.hairlineWidth},
  row: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  rowBody: {flex: 1, minWidth: 0},
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepDot: {
    alignItems: 'center',
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
})
