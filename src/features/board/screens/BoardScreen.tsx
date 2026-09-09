import {useLayoutEffect, useMemo, useState} from 'react'
import {ScrollView, StyleSheet, View} from 'react-native'
import {useNavigation, useRouter, type Href} from 'expo-router'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Surface} from '@/components/primitives/Surface'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import type {ModuleContribution} from '@/data/repositories/contracts'
import {useActivityQuery} from '@/features/activity/data'
import {useDiscoverQuery} from '@/features/discover/data'
import {useInstalledModulesQuery, useModuleContributionQuery} from '@/features/modules/hooks'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {BOARD_WIDGET_CATALOG} from '@/features/product/data/boardWidgets'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ChromeGlassControlGroup} from '@/platform/ui/menus/chrome-glass-control-group'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {PageIntro} from '@/platform/ui/chrome/page-intro'
import {SectionHeader} from '@/platform/ui/chrome/section-header'
import {ModulaIcon, type ModulaIconName} from '@/platform/ui/icons'
import {useNativeHeaderFadePadding} from '@/platform/ui/navigation/chrome-insets'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {BoardGridSkeleton} from '@/platform/ui/skeletons'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import {shareModulaText} from '@/platform/ui/share/share-modula-text'

const ALL_PINNED_SPACES: {
  id: string
  label: string
  icon: AppIconName
  route: string
  description: string
}[] = [
  {
    id: 'product-hub',
    label: 'Product Hub',
    icon: 'marketplace',
    route: '/product',
    description: 'Browse modules and tools',
  },
  {
    id: 'saved',
    label: 'Saved',
    icon: 'saved',
    route: '/saved',
    description: 'Posts and knowledge trails',
  },
  {
    id: 'collections',
    label: 'Collections',
    icon: 'bookmark',
    route: '/collections',
    description: 'Saved collections',
  },
  {
    id: 'lists',
    label: 'Lists',
    icon: 'people',
    route: '/lists',
    description: 'Custom feeds',
  },
  {
    id: 'drafts',
    label: 'Drafts',
    icon: 'text',
    route: '/drafts',
    description: 'Composer drafts',
  },
  {
    id: 'creator',
    label: 'Creator Studio',
    icon: 'poll',
    route: '/creator',
    description: 'Insights preview',
  },
]

const BOARD_FOCUS_POLICY_SENTENCES = {
  off: 'Focus is off, so Board follows normal Modula behavior and does not apply quiet-feed or work-priority rules.',
  light:
    'Light Focus policy bundles lower-priority notifications, reduces feed recommendations, quiets the dock, and prioritises active work on Board.',
  deep:
    'Deep Focus policy may hide feed and Reels, hold non-urgent chats, block unsolicited GAIA interruptions, and prioritise selected work modules on Board.',
  custom:
    'Custom Focus policy uses your saved toggles for feed quieting, navigation, pings, work priority, and Focus Halo on Board.',
} as const

export function BoardScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const router = useRouter()
  const navigation = useNavigation()
  const tabPadding = useFloatingTabBarContentPadding()
  const fadePad = useNativeHeaderFadePadding()
  const discoverQuery = useDiscoverQuery()
  const activityQuery = useActivityQuery()
  const boardContributions = useModuleContributionQuery({surface: 'board', enabledOnly: true})
  const installedModules = useInstalledModulesQuery()
  const modules = discoverQuery.data?.featuredModules ?? []
  const activity = activityQuery.data?.pages.flatMap(page => page.items) ?? []
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [pinnedIds, setPinnedIds] = useState(() =>
    ALL_PINNED_SPACES.map(space => space.id),
  )
  const {preferences, update: updatePreferences} = useProductPreferences()
  const boardWidgets = useMemo(
    () =>
      preferences.boardWidgetIds
        .map(id => BOARD_WIDGET_CATALOG.find(widget => widget.id === id))
        .filter((widget): widget is (typeof BOARD_WIDGET_CATALOG)[number] => Boolean(widget))
        .map(widget => {
          if (widget.id !== 'vault-notes') return widget
          const installed = installedModules.data?.find(item => item.moduleId === 'digital.modula.vault-notes')
          if (installed?.status === 'enabled') {
            return {...widget, status: 'Active' as const, description: 'Open private notes from the enabled Vault Notes module.'}
          }
          if (installed) {
            return {...widget, status: 'Disabled' as const, description: 'Vault Notes is installed but disabled. Enable it from Product Hub or Settings.'}
          }
          return widget
        }),
    [installedModules.data, preferences.boardWidgetIds],
  )

  const openBoardWidget = (widgetId: string) => {
    if (widgetId === 'vault-notes') {
      const installed = installedModules.data?.find(item => item.moduleId === 'digital.modula.vault-notes')
      if (installed?.status === 'enabled') {
        router.push('/module/digital.modula.vault-notes' as Href)
        return
      }
      router.push('/marketplace/digital.modula.vault-notes' as Href)
      return
    }
    if (widgetId === 'product-hub') {
      router.push('/product' as Href)
      return
    }
    if (widgetId === 'saved') {
      router.push('/saved' as Href)
      return
    }
    if (widgetId === 'profile') {
      router.push('/profile' as Href)
      return
    }
    if (widgetId === 'settings') {
      router.push('/settings' as Href)
      return
    }
    if (widgetId === 'activity') {
      router.push('/activity' as Href)
      return
    }
    router.push('/product/widgets' as Href)
  }

  const reorderWidget = (id: string, direction: -1 | 1) => {
    const ids = [...preferences.boardWidgetIds]
    const index = ids.indexOf(id)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return
    ;[ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]]
    void updatePreferences({boardWidgetIds: ids})
  }

  const removeWidget = (id: string) => {
    void updatePreferences({
      boardWidgetIds: preferences.boardWidgetIds.filter(item => item !== id),
    })
  }

  const pinnedSpaces = useMemo(
    () => ALL_PINNED_SPACES.filter(space => pinnedIds.includes(space.id)),
    [pinnedIds],
  )

  const loading = discoverQuery.isLoading && activityQuery.isLoading
  const focusHalo = preferences.focus.showHalo
  const focusPreset = preferences.focus.preset ?? 'off'
  const focusPresetTitle =
    focusPreset === 'off'
      ? 'Off'
      : focusPreset === 'light'
        ? 'Light'
        : focusPreset === 'deep'
          ? 'Deep'
          : 'Custom'

  useLayoutEffect(() => {
    const renderMenu = () => (
      <ChromeGlassControlGroup
        items={[
          {
            kind: 'menu',
            icon: 'more',
            accessibilityLabel: 'Board layout menu',
            title: 'Board',
            actions: [
              {id: 'customize', label: 'Customize pinned spaces', icon: 'appearance'},
              {id: 'marketplace', label: 'Open Product Hub', icon: 'modules'},
              {id: 'saved', label: 'Open Saved', icon: 'bookmark'},
              {id: 'compose', label: 'Quick compose', icon: 'create'},
            ],
            onAction: id => {
              if (id === 'customize') setCustomizeOpen(true)
              if (id === 'marketplace') router.push('/product' as Href)
              if (id === 'saved') router.push('/saved' as Href)
              if (id === 'compose') router.push('/compose' as Href)
            },
          },
        ]}
      />
    )
    navigation.setOptions({
      headerRight: renderMenu,
    })
  }, [navigation, router])

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <ResponsiveContent maxWidth={760}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={[
            styles.content,
            {
              gap: spacing[5],
              paddingTop: fadePad,
              paddingBottom: tabPadding,
            },
          ]}
          keyboardShouldPersistTaps="handled">
          <SectionEnter>
            <PageIntro
              eyebrow="Workspace"
              icon="board"
              body="Modules, widgets, and next actions — your private operating surface."
            />
          </SectionEnter>

          <SectionEnter delay={40}>
          <View style={{gap: spacing[2]}}>
            <SectionHeader title="Focus" icon="sparkles" />
            <View style={{gap: spacing[2]}}>
              <AppText variant="headline">
                {focusHalo
                  ? `Focus · ${focusPresetTitle}`
                  : focusPreset === 'off'
                    ? 'Focus off'
                    : 'Current focus'}
              </AppText>
              <AppText variant="body" colour="textSecondary">
                {BOARD_FOCUS_POLICY_SENTENCES[focusPreset]}
              </AppText>
              <AppPressable
                accessibilityLabel="Open Focus Mode"
                onPress={() => router.push('/product/focus' as Href)}>
                <AppText variant="label">Open Focus Mode</AppText>
              </AppPressable>
            </View>
          </View>
          </SectionEnter>

          <SectionEnter delay={80}>
          <View style={{gap: spacing[3]}}>
            <SectionHeader
              title="Widgets"
              icon="modules"
              trailing="Manage"
              onPress={() => router.push('/product/widgets' as Href)}
            />
            {boardWidgets.length === 0 ? (
              <AppText variant="caption" colour="textSecondary">
                No widgets on Board — add some in Widgets studio.
              </AppText>
            ) : (
              <View style={[styles.moduleGrid, {gap: spacing[3]}]}>
                {boardWidgets.map((widget, index) => (
                  <ModulaContextMenu
                    key={widget.id}
                    accessibilityLabel={`${widget.name} widget actions`}
                    actions={[
                      {id: 'up', label: 'Move up', disabled: index === 0},
                      {
                        id: 'down',
                        label: 'Move down',
                        disabled: index === boardWidgets.length - 1,
                      },
                      {id: 'remove', label: 'Remove from Board', style: 'destructive'},
                      {id: 'manage', label: 'Manage widgets'},
                    ]}
                    onAction={id => {
                      if (id === 'up') reorderWidget(widget.id, -1)
                      if (id === 'down') reorderWidget(widget.id, 1)
                      if (id === 'remove') removeWidget(widget.id)
                      if (id === 'manage') router.push('/product/widgets' as Href)
                    }}>
                    <AppPressable
                      accessibilityLabel={`Open ${widget.name}`}
                      onPress={() => openBoardWidget(widget.id)}>
                    <Surface
                      variant="contained"
                      style={[
                        styles.widgetCard,
                        {
                          backgroundColor: colours.surface,
                          borderColor: colours.border,
                          borderRadius: radius.large,
                          padding: spacing[4],
                          gap: spacing[2],
                          flexBasis: widget.size.startsWith('2') ? '100%' : '47%',
                        },
                      ]}>
                      <AppIcon name={widget.icon} colour={colours.text} size={22} />
                      <AppText variant="headline">{widget.name}</AppText>
                      <AppText variant="caption" colour="textSecondary">
                        {widget.description}
                      </AppText>
                    </Surface>
                    </AppPressable>
                  </ModulaContextMenu>
                ))}
              </View>
            )}
          </View>
          </SectionEnter>

          <SectionEnter delay={120}>
          <View style={{gap: spacing[2]}}>
            <SectionHeader title="Studios" icon="tools" />
            {[
              {label: 'Design Lab', route: '/settings/appearance-lab', icon: 'appearance' as ModulaIconName},
              {label: 'Intelligence', route: '/product/intelligence', icon: 'sparkles' as ModulaIconName},
              {label: 'Forge', route: '/product/forge', icon: 'developer' as ModulaIconName},
              {label: 'Gaia', route: '/product/gaia', icon: 'automation' as ModulaIconName},
              {label: 'Widgets', route: '/product/widgets', icon: 'modules' as ModulaIconName},
            ].map(item => (
              <AppPressable
                key={item.route}
                accessibilityLabel={item.label}
                onPress={() => router.push(item.route as Href)}
                style={[styles.studioRow, {borderBottomColor: colours.separator}]}>
                <ModulaIcon name={item.icon} colour={colours.text} size={18} />
                <AppText variant="label" style={styles.studioLabel}>
                  {item.label}
                </AppText>
                <AppIcon name="chevronRight" colour={colours.textTertiary} size={16} />
              </AppPressable>
            ))}
          </View>
          </SectionEnter>

          <View style={{gap: spacing[3]}}>
            <SectionHeader
              title="Pinned spaces"
              icon="board"
              trailing="Customize"
              onPress={() => setCustomizeOpen(true)}
            />
            {loading ? (
              <BoardGridSkeleton />
            ) : pinnedSpaces.length === 0 ? (
              <Surface
                variant="contained"
                style={[
                  styles.emptyBoard,
                  {
                    gap: spacing[3],
                    padding: spacing[4],
                    borderRadius: radius.large,
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                  },
                ]}>
                <AppIcon name="board" colour={colours.textTertiary} size={28} />
                <AppText variant="headline">Pin your daily surfaces</AppText>
                <AppText variant="body" colour="textSecondary">
                  Board stays empty until you choose spaces — Product Hub, Saved, Lists, and more.
                </AppText>
                <AppPressable
                  accessibilityLabel="Customize pinned spaces"
                  onPress={() => setCustomizeOpen(true)}>
                  <AppText variant="label" colour="accent">
                    Customize pinned spaces
                  </AppText>
                </AppPressable>
              </Surface>
            ) : (
              <View style={[styles.moduleGrid, {gap: spacing[3]}]}>
                {pinnedSpaces.map(space => (
                  <ModulaContextMenu
                    key={space.route}
                    accessibilityLabel={`${space.label} actions`}
                    actions={[
                      {id: 'open', label: 'Open'},
                      {id: 'unpin', label: 'Unpin from Board'},
                      {id: 'share', label: 'Share link preview'},
                    ]}
                    onAction={id => {
                      if (id === 'open') router.push(space.route as Href)
                      if (id === 'unpin') {
                        setPinnedIds(prev => prev.filter(item => item !== space.id))
                      }
                      if (id === 'share') {
                        void shareModulaText({
                          title: space.label,
                          message: space.description,
                          url: `https://modula.digital${space.route}`,
                        })
                      }
                    }}>
                    <AppPressable
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
                      <AppIcon name={space.icon} colour={colours.text} />
                      <View style={{gap: spacing[1]}}>
                        <AppText variant="headline">{space.label}</AppText>
                        <AppText variant="caption" colour="textSecondary">
                          {space.description}
                        </AppText>
                      </View>
                    </AppPressable>
                  </ModulaContextMenu>
                ))}
              </View>
            )}
          </View>

          <FeatureErrorBoundary label="Board module contributions">
            <View style={{gap: spacing[3]}}>
              <SectionHeader
                title="Module contributions"
                icon="modules"
                trailing="Manage"
                onPress={() => router.push('/settings/modules' as Href)}
              />
              {boardContributions.isPending ? (
                <AppText variant="caption" colour="textSecondary">
                  Loading Board module contributions.
                </AppText>
              ) : (boardContributions.data ?? []).length ? (
                <View style={[styles.moduleGrid, {gap: spacing[3]}]}>
                  {boardContributions.data?.map(contribution => (
                    <BoardContributionCard
                      key={`${contribution.moduleId}-${contribution.id}`}
                      contribution={contribution}
                      onOpen={() =>
                        router.push(`/module/${encodeURIComponent(contribution.moduleId)}` as Href)
                      }
                      onManage={() =>
                        router.push(`/settings/modules/${encodeURIComponent(contribution.moduleId)}` as Href)
                      }
                    />
                  ))}
                </View>
              ) : (
                <Surface
                  variant="contained"
                  style={[
                    styles.emptyBoard,
                    {
                      gap: spacing[2],
                      padding: spacing[4],
                      borderRadius: radius.large,
                      backgroundColor: colours.surface,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppIcon name="modules" colour={colours.textTertiary} size={24} />
                  <AppText variant="headline">No active Board modules</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    Enabled modules can register launcher, summary, card, or list contributions here.
                  </AppText>
                </Surface>
              )}
            </View>
          </FeatureErrorBoundary>

          <FeatureErrorBoundary label="Board module grid">
            <View style={{gap: spacing[3]}}>
              <SectionHeader
                title="Modules"
                icon="modules"
                trailing="Browse"
                onPress={() => router.push('/product' as Href)}
              />
              {modules.length === 0 ? (
                <Surface
                  variant="contained"
                  style={[
                    styles.emptyBoard,
                    {
                      gap: spacing[3],
                      padding: spacing[4],
                      borderRadius: radius.large,
                      backgroundColor: colours.surfaceRaised,
                      borderColor: colours.border,
                    },
                  ]}>
                  <AppIcon name="modules" colour={colours.textTertiary} size={28} />
                  <AppText variant="headline">Install your first capability</AppText>
                  <AppText variant="body" colour="textSecondary">
                    Modules like Vault Notes, Tasks, and CRM ship as packages through Product Hub.
                  </AppText>
                  <AppPressable
                    accessibilityLabel="Open Product Hub"
                    onPress={() => router.push('/product' as Href)}>
                    <AppText variant="label" colour="accent">
                      Open Product Hub
                    </AppText>
                  </AppPressable>
                </Surface>
              ) : null}
              <View style={[styles.moduleGrid, {gap: spacing[3]}]}>
                {modules.map(module => (
                  <View key={module.id} style={styles.moduleCardWrap}>
                    <ModulaContextMenu
                      accessibilityLabel={`${module.name} module actions`}
                      actions={[
                        {id: 'open', label: 'Open', icon: 'modules'},
                        {id: 'preview', label: 'Preview', icon: 'eye'},
                        {id: 'pin', label: 'Pin to Board', icon: 'bookmark'},
                      ]}
                      onAction={id => {
                        if (id === 'open' || id === 'preview' || id === 'pin') {
                          router.push(moduleMarketplaceHref(module.id))
                        }
                      }}>
                      <AppPressable
                        accessibilityLabel={`Open ${module.name}`}
                        onPress={() => router.push(moduleMarketplaceHref(module.id))}
                        style={[
                          styles.moduleCard,
                          {
                            backgroundColor: colours.surface,
                            borderColor: colours.border,
                            borderRadius: radius.large,
                            padding: spacing[4],
                          },
                        ]}>
                        <AppIcon name={module.icon} colour={colours.text} />
                        <View style={{gap: spacing[1]}}>
                          <AppText variant="headline">{module.name}</AppText>
                          <AppText variant="caption" colour="textSecondary">
                            {module.description}
                          </AppText>
                        </View>
                        <AppText variant="caption" colour="textSecondary">
                          {module.status}
                        </AppText>
                      </AppPressable>
                    </ModulaContextMenu>
                  </View>
                ))}
              </View>
            </View>
          </FeatureErrorBoundary>

          <View style={{gap: spacing[3]}}>
            <SectionHeader
              title="Recent activity"
              icon="activity"
              trailing="All"
              onPress={() => router.push('/activity' as Href)}
            />
            {activity.slice(0, 3).map(item => (
              <AppPressable
                key={item.id}
                accessibilityLabel={item.description}
                onPress={() => {
                  if (item.type === 'moduleUpdate') {
                    router.push('/marketplace/digital.modula.vault-notes' as Href)
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

      <ModulaSheet
        isPresented={customizeOpen}
        onDismiss={() => setCustomizeOpen(false)}
        snapPoints={[{fraction: 0.65}, 'full']}
        testID="board-customize-sheet">
        <View style={{gap: spacing[3]}}>
          <AppText variant="headline">Customize pinned spaces</AppText>
          <AppText variant="caption" colour="textSecondary">
            Toggle which spaces appear on your Board. Signed-in layouts sync through Greenfield.
          </AppText>
          {ALL_PINNED_SPACES.map(space => {
            const pinned = pinnedIds.includes(space.id)
            return (
              <AppPressable
                key={space.id}
                accessibilityLabel={`${pinned ? 'Unpin' : 'Pin'} ${space.label}`}
                onPress={() => {
                  setPinnedIds(prev =>
                    pinned
                      ? prev.filter(id => id !== space.id)
                      : [...prev, space.id],
                  )
                }}
                style={[
                  styles.customizeRow,
                  {
                    backgroundColor: pinned ? colours.surface : colours.surfaceRaised,
                    borderRadius: radius.medium,
                  },
                ]}>
                <AppIcon name={space.icon} colour={colours.text} />
                <View style={styles.focusBody}>
                  <AppText variant="label" numberOfLines={1}>
                    {space.label}
                  </AppText>
                  <AppText variant="caption" colour="textSecondary" numberOfLines={1}>
                    {space.description}
                  </AppText>
                </View>
                <AppText variant="caption" colour="textSecondary">
                  {pinned ? 'Pinned' : 'Off'}
                </AppText>
              </AppPressable>
            )
          })}
        </View>
      </ModulaSheet>
    </View>
  )
}

function BoardContributionCard({
  contribution,
  onOpen,
  onManage,
}: {
  contribution: ModuleContribution
  onOpen: () => void
  onManage: () => void
}) {
  const {colours, radius, spacing} = useThemeTokens()
  const manifest = contribution.manifest ?? {}
  const title = String(manifest.title ?? manifest.name ?? contribution.id)
  const description = String(
    manifest.description ??
      (contribution.available
        ? 'Registered module contribution.'
        : 'This contribution is unavailable without breaking Board.'),
  )
  return (
    <Surface
      variant="contained"
      style={[
        styles.moduleContributionCard,
        {
          backgroundColor: contribution.available ? colours.surface : colours.surfaceRaised,
          borderColor: contribution.available ? colours.border : colours.warning,
          borderRadius: radius.large,
          gap: spacing[3],
          padding: spacing[4],
        },
      ]}>
      <View style={[styles.moduleContributionHeader, {gap: spacing[3]}]}>
        <AppIcon name="modules" colour={colours.text} />
        <View style={styles.focusBody}>
          <AppText variant="headline">{title}</AppText>
        </View>
      </View>
      <AppText variant="caption" colour="textSecondary">{description}</AppText>
      <View style={[styles.actionsRow, {gap: spacing[3]}]}>
        <AppPressable accessibilityLabel={`Open ${title}`} onPress={onOpen}>
          <AppText variant="label" colour="accent">Open</AppText>
        </AppPressable>
        <AppPressable accessibilityLabel="Open module settings" onPress={onManage}>
          <AppText variant="label" colour="accent">Settings</AppText>
        </AppPressable>
      </View>
      {!contribution.available ? (
        <AppText variant="caption" colour="textTertiary">
          {contribution.disabledReason ?? 'Unavailable'}
        </AppText>
      ) : null}
    </Surface>
  )
}

function moduleMarketplaceHref(moduleId: string): Href {
  const mapped =
    moduleId === 'module-vault-notes'
      ? 'digital.modula.vault-notes'
      : moduleId === 'module-tasks'
        ? 'digital.modula.tasks'
        : moduleId
  return `/marketplace/${encodeURIComponent(mapped)}` as Href
}

const styles = StyleSheet.create({
  activityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 52,
  },
  content: {
    padding: 16,
  },
  emptyBoard: {
    borderWidth: StyleSheet.hairlineWidth,
    width: '100%',
  },
  actionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  studioLabel: {flex: 1},
  studioRow: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 12,
    minHeight: 48,
  },
  widgetCard: {
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1,
    minWidth: 140,
  },
  customizeHit: {
    justifyContent: 'center',
    minHeight: 32,
  },
  customizeRow: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
    width: '100%',
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
    gap: 12,
    minHeight: 156,
    width: '100%',
  },
  moduleCardWrap: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  moduleContributionCard: {
    borderWidth: StyleSheet.hairlineWidth,
    flexBasis: '48%',
    flexGrow: 1,
    minWidth: 160,
  },
  moduleContributionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  moduleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  screen: {
    flex: 1,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
})
