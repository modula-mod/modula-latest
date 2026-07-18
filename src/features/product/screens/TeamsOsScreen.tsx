import {Pressable, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ROLES = [
  {
    id: 'owner',
    label: 'Owner',
    desc: 'Owns the team profile, seat policy, billing direction, module admission, and final approval for high-risk actions. Owners can delegate day-to-day work, but they remain accountable for data export, member removal, and audit review.',
    permissions: ['Billing future', 'Roles', 'Module approvals', 'Ledger view'],
  },
  {
    id: 'admin',
    label: 'Admin',
    desc: 'Runs the operating layer for members, modules, Board layout, automations, and review queues. Admins can prepare changes for the Owner and resolve normal workflow approvals without taking ownership away from the team profile.',
    permissions: ['Roles', 'Board layout', 'Module approvals', 'Automations'],
  },
  {
    id: 'editor',
    label: 'Editor',
    desc: 'Creates and maintains shared content, posts, resources, task lanes, and Board widgets. Editors can draft organization-facing updates and request promotion, while approval gates protect publishing, module scopes, and external commitments.',
    permissions: ['Posts', 'Board widgets', 'Files preview', 'Tasks'],
  },
  {
    id: 'member',
    label: 'Member',
    desc: 'Collaborates in the shared workspace through posts, comments, tasks, files, and availability signals. Members keep their personal Profile-OS data separate from team state unless they explicitly share a surface or module result.',
    permissions: ['Posts', 'Comments', 'Tasks', 'Availability'],
  },
  {
    id: 'guest',
    label: 'Guest',
    desc: 'Receives limited visibility for reviews, partner work, or client collaboration. Guests can comment where invited, but sensitive modules, team settings, and broad publishing actions require approval from a trusted role.',
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
  {
    step: 'Draft',
    owner: 'Editor',
    state: 'Local draft',
    detail:
      'The work starts as a local draft with visible intent, destination, and risk. Drafts can describe posts, task changes, module recommendations, or automation ideas without executing them.',
  },
  {
    step: 'Review',
    owner: 'Admin',
    state: 'Approval stub',
    detail:
      'Admins check whether the draft matches team policy, member expectations, and module permission boundaries. Review can request changes or escalate to the Owner for sensitive scope.',
  },
  {
    step: 'Verify',
    owner: 'AKI',
    state: 'Preview verification',
    detail:
      'AKI verification is represented as Preview copy here: it explains the future check for claims, permissions, and risk, but it does not run unattended validation or background actions.',
  },
  {
    step: 'Publish',
    owner: 'Owner/Admin',
    state: 'Manual only',
    detail:
      'Publishing stays manual. The responsible Owner or Admin confirms the final action after reviewing copy, audience, module scopes, and the Ledger-facing explanation.',
  },
] as const

const GUIDELINES = [
  {
    label: 'One team profile, many personal boundaries',
    detail:
      'Teams reuse Profile-OS as a shared operating surface. Personal profiles, private Boards, Focus state, and account ownership remain separate unless a member explicitly shares context into the team.',
  },
  {
    label: 'Least-privilege modules',
    detail:
      'Modules should request only the scopes needed for the shared job. Admins and Owners review higher-risk scopes before a module affects shared Board widgets, files, CRM, automations, or publishing.',
  },
  {
    label: 'Human confirmation for consequential work',
    detail:
      'Posts, automations, billing direction, member removal, and external commitments need an explicit trusted-role confirmation. Preview cards can prepare the action, but they do not silently execute it.',
  },
  {
    label: 'Availability without surveillance',
    detail:
      'Focus and availability help route work respectfully. Teams can show high-level status and interruption policy without exposing private reasons, personal messages, or unrelated module content.',
  },
] as const

const AVAILABILITY = [
  {label: 'Deep focus', detail: 'Quiet feed and suppress pings where Focus prefs allow.'},
  {label: 'Available', detail: 'Team can route mentions, tasks, and CRM follow-ups.'},
  {label: 'Approval needed', detail: 'Guests and risky module actions require review.'},
] as const

const PRODUCT_LINKS = [
  {
    label: 'Design Lab',
    detail: 'Open the Forge builder surface for team module, workflow, and workspace drafts.',
    href: '/product/forge' as Href,
    icon: 'tools',
  },
  {
    label: 'Atlas',
    detail: 'Browse Feature Atlas entries for teams, roles, approvals, modules, and shared Board work.',
    href: '/product/atlas' as Href,
    icon: 'search',
  },
  {
    label: 'Focus',
    detail: 'Review Focus modes and availability rules that help teams route interruptions respectfully.',
    href: '/product/focus' as Href,
    icon: 'switch',
  },
  {
    label: 'Ledger',
    detail: 'Inspect seeded replay language for approval trails and audit-sensitive team actions.',
    href: '/product/ledger' as Href,
    icon: 'storage',
  },
] as const

function isTeamRoleId(value: string): value is TeamRoleId {
  return ROLES.some(role => role.id === value)
}

export function TeamsOsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()
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
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
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
                  style={styles.rolePressable}
                  onPress={() => {
                    void update({teamsRoleId: item.id})
                  }}>
                  <Surface
                    variant="contained"
                    style={[
                      styles.role,
                      {
                        padding: spacing[3],
                        gap: spacing[1],
                        borderRadius: radius.medium,
                        backgroundColor: on ? colours.accentSubtle : colours.surface,
                        borderColor: on ? colours.accent : colours.border,
                      },
                    ]}>
                    <AppText variant="caption" colour={on ? 'accent' : 'text'}>
                      {item.label}
                    </AppText>
                    <AppText variant="caption" colour="textTertiary">
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
                    <AppText variant="caption" colour="textSecondary">
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
            <AppText variant="headline">Guidelines</AppText>
            {GUIDELINES.map(item => (
              <View key={item.label} style={{gap: spacing[1]}}>
                <AppText variant="label">{item.label}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {item.detail}
                </AppText>
              </View>
            ))}
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
                  <AppText variant="caption" colour="textSecondary">
                    {item.detail}
                  </AppText>
                </View>
              </View>
            ))}
            <AppText variant="caption" colour="textTertiary">
              Preview only: approvals are local stubs, verification copy is explanatory, and publish
              remains manual.
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
            <AppText variant="headline">Product links</AppText>
            {PRODUCT_LINKS.map(item => (
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
                  <AppIcon name={item.icon} colour={colours.accent} size={18} />
                  <View style={styles.rowBody}>
                    <AppText variant="body">{item.label}</AppText>
                    <AppText variant="caption" colour="textSecondary">
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
  rolePressable: {flexBasis: 240, flexGrow: 1},
  roles: {flexDirection: 'row', flexWrap: 'wrap'},
  role: {borderWidth: StyleSheet.hairlineWidth, minHeight: 128},
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
