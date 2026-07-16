import {ScrollView, StyleSheet, View} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {useSession} from '@/auth/runtime'
import {useActivityQuery} from '@/features/activity/data'
import {useDiscoverQuery} from '@/features/discover/data'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const pinnedSpaces: Array<{
  label: string
  icon: AppIconName
  route: string
  description: string
}> = [
  {
    label: 'Marketplace',
    icon: 'marketplace',
    route: '/marketplace',
    description: 'Browse modules and tools',
  },
  {
    label: 'Saved',
    icon: 'saved',
    route: '/saved',
    description: 'Posts and knowledge trails',
  },
  {
    label: 'Collections',
    icon: 'bookmark',
    route: '/collections',
    description: 'Saved collections Preview',
  },
  {
    label: 'Lists',
    icon: 'people',
    route: '/lists',
    description: 'Custom feeds Preview',
  },
  {
    label: 'Drafts',
    icon: 'text',
    route: '/drafts',
    description: 'Composer drafts Preview',
  },
  {
    label: 'Creator Studio',
    icon: 'poll',
    route: '/creator',
    description: 'Insights Preview',
  },
]

export function BoardScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const router = useRouter()
  const session = useSession()
  const discoverQuery = useDiscoverQuery()
  const activityQuery = useActivityQuery()
  const ownerName = session.status === 'signedIn' ? session.profile.displayName : 'there'
  const modules = discoverQuery.data?.featuredModules ?? []
  const activity = activityQuery.data?.pages.flatMap(page => page.items) ?? []

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader
        title="Board"
        right={
          <ModulaMenu
            accessibilityLabel="Board layout menu"
            title="Board layout"
            actions={[
              {id: 'focus', label: 'Focus first'},
              {id: 'modules', label: 'Modules first'},
              {id: 'marketplace', label: 'Open Marketplace'},
              {id: 'saved', label: 'Open Saved'},
            ]}
            onAction={id => {
              if (id === 'marketplace') router.push('/marketplace' as Href)
              if (id === 'saved') router.push('/saved' as Href)
            }}
            trigger={<AppIcon name="more" colour={colours.textSecondary} />}
          />
        }
      />
      <ResponsiveContent maxWidth={760}>
        <ScrollView
          contentContainerStyle={[styles.content, {gap: spacing[5]}]}
          keyboardShouldPersistTaps="handled">
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Good focus, {ownerName}</AppText>
            <AppText variant="body" colour="textSecondary">
              Your local Modula Board gathers pinned spaces and next useful actions.
            </AppText>
          </View>

          <Surface
            variant="contained"
            style={[styles.focus, {gap: spacing[3], padding: spacing[4]}]}>
            <View
              style={[
                styles.focusIcon,
                {backgroundColor: colours.accentSubtle, borderRadius: radius.medium},
              ]}>
              <AppIcon name="board" colour={colours.accent} />
            </View>
            <View style={styles.focusBody}>
              <AppText variant="headline">Current focus</AppText>
              <AppText variant="body" colour="textSecondary">
                Validate Phase 4.5 expansion surfaces — Marketplace, Settings, and Saved — before
                production backends.
              </AppText>
            </View>
          </Surface>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Pinned spaces</AppText>
            <View style={[styles.moduleGrid, {gap: spacing[3]}]}>
              {pinnedSpaces.map(space => (
                <AppPressable
                  key={space.route}
                  accessibilityLabel={space.label}
                  onPress={() => router.push(space.route as Href)}
                  style={[
                    styles.moduleCard,
                    {
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                      borderRadius: radius.large,
                      padding: spacing[4],
                    },
                  ]}>
                  <AppIcon name={space.icon} colour={colours.accent} />
                  <View style={{gap: spacing[1]}}>
                    <AppText variant="headline">{space.label}</AppText>
                    <AppText variant="caption" colour="textSecondary">
                      {space.description}
                    </AppText>
                  </View>
                </AppPressable>
              ))}
            </View>
          </View>

          <View style={[styles.quickActions, {gap: spacing[2]}]}>
            {[
              ['Create', 'create', '/compose'],
              ['Discover', 'discover', '/discover'],
              ['Profile', 'profile', '/profile'],
            ].map(([label, icon, route]) => (
              <AppPressable
                key={label}
                accessibilityLabel={label}
                onPress={() => router.push(route as Href)}
                style={[
                  styles.quickAction,
                  {
                    backgroundColor: colours.surfaceRaised,
                    borderColor: colours.border,
                    borderRadius: radius.medium,
                  },
                ]}>
                <AppIcon name={icon as AppIconName} colour={colours.accent} />
                <AppText variant="label">{label}</AppText>
              </AppPressable>
            ))}
          </View>

          <FeatureErrorBoundary label="Board module grid">
            <View style={{gap: spacing[3]}}>
              <AppText variant="headline">Modules</AppText>
              <View style={[styles.moduleGrid, {gap: spacing[3]}]}>
                {modules.map(module => (
                  <AppPressable
                    key={module.id}
                    accessibilityLabel={`Open ${module.name}`}
                    onPress={() => router.push(`/marketplace/${module.id}` as Href)}
                    style={[
                      styles.moduleCard,
                      {
                        backgroundColor: colours.surface,
                        borderColor: colours.border,
                        borderRadius: radius.large,
                        padding: spacing[4],
                      },
                    ]}>
                    <AppIcon name={module.icon} colour={colours.accent} />
                    <View style={{gap: spacing[1]}}>
                      <AppText variant="headline">{module.name}</AppText>
                      <AppText variant="caption" colour="textSecondary">
                        {module.description}
                      </AppText>
                    </View>
                    <AppText variant="caption" colour="accent">
                      {module.status}
                    </AppText>
                  </AppPressable>
                ))}
              </View>
            </View>
          </FeatureErrorBoundary>

          <View style={{gap: spacing[3]}}>
            <AppText variant="headline">Recent activity</AppText>
            {activity.slice(0, 3).map(item => (
              <AppPressable
                key={item.id}
                accessibilityLabel={item.description}
                onPress={() => {
                  if (item.type === 'moduleUpdate') {
                    router.push('/marketplace/module-vault-notes' as Href)
                    return
                  }
                  if (item.actor) {
                    router.push(`/profile/${item.actor.handle}` as Href)
                    return
                  }
                  router.push('/activity' as Href)
                }}
                style={[styles.activityRow, {gap: spacing[3]}]}>
                <AppIcon name={item.icon ?? 'activity'} colour={colours.textSecondary} />
                <View style={styles.focusBody}>
                  <AppText variant="body">{item.description}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {item.timestamp}
                  </AppText>
                </View>
                <AppIcon name="chevronRight" colour={colours.textTertiary} size={18} />
              </AppPressable>
            ))}
          </View>
        </ScrollView>
      </ResponsiveContent>
    </View>
  )
}

const styles = StyleSheet.create({
  activityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 52,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  focus: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  focusBody: {
    flex: 1,
    minWidth: 0,
  },
  focusIcon: {
    alignItems: 'center',
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  moduleCard: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '48%',
    gap: 12,
    minHeight: 156,
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickAction: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  quickActions: {
    flexDirection: 'row',
  },
  screen: {
    flex: 1,
  },
})
