import {Pressable, ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppButton} from '@/components/primitives/AppButton'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {seededCommunities} from '@/features/social/data/seededSurfaces'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const COMMUNITY_ROLES = [
  {
    label: 'Space owner',
    detail:
      'Defines the community charter, membership policy, featured modules, and escalation path. Owners can request higher-risk changes, but publishing and module changes remain explicit and manual in this Preview.',
  },
  {
    label: 'Moderator',
    detail:
      'Keeps discussion aligned with the charter, reviews reports, labels resources, and proposes holds when a post, module, or event needs a second look before it is promoted.',
  },
  {
    label: 'Contributor',
    detail:
      'Creates posts, drafts guides, curates resources, and starts event ideas. Contributor work can be featured after review without giving broad admin access to the whole space.',
  },
  {
    label: 'Member',
    detail:
      'Reads, replies, saves resources, joins events, and follows module updates. Membership does not transfer profile ownership, private Board data, or module scopes to the community.',
  },
  {
    label: 'Guest',
    detail:
      'Views public context and selected resources when a space allows it. Guest activity is intentionally limited until a member, moderator, or owner approves deeper participation.',
  },
] as const

const COMMUNITY_GUIDELINES = [
  {
    label: 'Purpose before growth',
    detail:
      'Each space should explain what belongs, what does not, and why the community exists. Discovery can amplify a space only after the charter is clear enough for members to evaluate.',
  },
  {
    label: 'Member-owned context',
    detail:
      'Communities attach to Profile-OS, but they do not own a member profile. Saves, Board cards, Focus state, private notes, and module permissions stay under the member account.',
  },
  {
    label: 'Transparent module use',
    detail:
      'Recommended modules must show capability intent, maturity, and permission boundaries. Planned or inactive capabilities stay labelled as planned or inactive, not dressed up as live features.',
  },
  {
    label: 'Focus-aware participation',
    detail:
      'Communities should respect Focus preferences. Urgent labels, announcements, and event reminders need clear intent so quiet modes can defer non-essential interruptions.',
  },
] as const

const COMMUNITY_APPROVALS = [
  {
    label: 'Guideline change',
    detail:
      'Owner drafts the change, moderators review the member impact, and the final copy is published manually after the visible charter is updated.',
  },
  {
    label: 'Featured resource',
    detail:
      'Contributors can propose guides, files, links, or module collections. Moderators approve the feature card before it appears in the community resource area.',
  },
  {
    label: 'Module recommendation',
    detail:
      'Owners or moderators check maturity, permissions, and safety copy before recommending a module to members. Install and billing flows are not automated from this Preview.',
  },
  {
    label: 'Sponsored or high-reach post',
    detail:
      'Any sponsored, partner, or high-reach announcement needs explicit owner/admin review, visible attribution, and manual publish confirmation.',
  },
] as const

const PRODUCT_LINKS = [
  {
    label: 'Design Lab',
    detail: 'Open the Forge builder surface for module and community design drafts.',
    href: '/product/forge' as Href,
    icon: 'tools',
  },
  {
    label: 'Atlas',
    detail: 'Browse the Feature Atlas entries that map Communities OS capabilities.',
    href: '/product/atlas' as Href,
    icon: 'search',
  },
  {
    label: 'Focus',
    detail: 'Review Focus modes that shape announcements, pings, and availability.',
    href: '/product/focus' as Href,
    icon: 'switch',
  },
  {
    label: 'Ledger',
    detail: 'Inspect Preview replay language for approvals and audit-sensitive actions.',
    href: '/product/ledger' as Href,
    icon: 'storage',
  },
] as const

export function CommunitiesOsScreen() {
  const router = useRouter()
  const {colours, radius, spacing} = useThemeTokens()
  const tabPadding = useFloatingTabBarContentPadding()

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader title="Communities" />
      <ResponsiveContent maxWidth={720}>
        <ScrollView contentContainerStyle={{gap: spacing[5], padding: spacing[4], paddingBottom: tabPadding}}>
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Groups inside Profile-OS.</AppText>
            <AppText variant="body" colour="textSecondary">
              Communities, forums, and membership spaces attach to profiles and Teams — seeded
              Preview below.
            </AppText>
          </View>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Community roles</AppText>
            <View style={[styles.roleGrid, {gap: spacing[3]}]}>
              {COMMUNITY_ROLES.map(role => (
                <Surface
                  key={role.label}
                  variant="contained"
                  style={[
                    styles.roleCard,
                    {
                      padding: spacing[4],
                      gap: spacing[2],
                      borderRadius: radius.medium,
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppText variant="label">{role.label}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {role.detail}
                  </AppText>
                </Surface>
              ))}
            </View>
          </View>

          {seededCommunities.map(community => (
            <Surface
              key={community.id}
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
              <View style={[styles.row, {gap: spacing[2]}]}>
                <AppIcon name="community" colour={colours.accent} />
                <AppText variant="headline">{community.name}</AppText>
              </View>
              <AppText variant="body" colour="textSecondary">
                {community.description}
              </AppText>
              <AppText variant="caption" colour="textTertiary">
                {community.membersLabel} · {community.topic}
              </AppText>
              <AppButton
                variant="secondary"
                onPress={() => router.push(`/communities/${community.id}` as Href)}>
                Open
              </AppButton>
            </Surface>
          ))}

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
            {COMMUNITY_GUIDELINES.map(item => (
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
            <AppText variant="headline">Approvals</AppText>
            {COMMUNITY_APPROVALS.map(item => (
              <View key={item.label} style={{gap: spacing[1]}}>
                <AppText variant="label">{item.label}</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {item.detail}
                </AppText>
              </View>
            ))}
            <AppText variant="caption" colour="textTertiary">
              Preview only: approval copy explains intended governance. No community workflow
              sends, installs, bills, or publishes without an explicit human action.
            </AppText>
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Product links</AppText>
            {PRODUCT_LINKS.map(item => (
              <Pressable key={item.label} onPress={() => router.push(item.href)}>
                <Surface
                  variant="contained"
                  style={[
                    styles.linkRow,
                    {
                      padding: spacing[4],
                      gap: spacing[2],
                      borderRadius: radius.medium,
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppIcon name={item.icon} colour={colours.accent} size={18} />
                  <View style={styles.linkBody}>
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

          <AppButton onPress={() => router.push('/marketplace/module-communities' as Href)}>
            Communities module card
          </AppButton>
          <AppButton variant="ghost" onPress={() => router.push('/product' as Href)}>
            Product Hub
          </AppButton>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: {flex: 1},
  card: {borderWidth: StyleSheet.hairlineWidth},
  linkBody: {flex: 1, minWidth: 0},
  linkRow: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  roleCard: {borderWidth: StyleSheet.hairlineWidth, flexBasis: 240, flexGrow: 1},
  roleGrid: {flexDirection: 'row', flexWrap: 'wrap'},
  row: {alignItems: 'center', flexDirection: 'row'},
})
