import {useEffect, useMemo, useState} from 'react'
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
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {BOARD_WIDGET_CATALOG} from '@/features/product/data/boardWidgets'
import {
  loadProductPreferences,
  patchProductPreferences,
} from '@/features/product/storage/productPreferencesStorage'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaControlGroup} from '@/platform/ui/menus/modula-control-group'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {BoardGridSkeleton} from '@/platform/ui/skeletons'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {SecondaryScreenHeader} from '@/shell/SecondaryScreenHeader'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

const ALL_PINNED_SPACES: Array<{
  id: string
  label: string
  icon: AppIconName
  route: string
  description: string
}> = [
  {
    id: 'marketplace',
    label: 'Marketplace',
    icon: 'marketplace',
    route: '/marketplace',
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

export function BoardScreen() {
  const {colours, radius, spacing} = useThemeTokens()
  const router = useRouter()
  const tabPadding = useFloatingTabBarContentPadding()
  const session = useSession()
  const discoverQuery = useDiscoverQuery()
  const activityQuery = useActivityQuery()
  const ownerName = session.status === 'signedIn' ? session.profile.displayName : 'there'
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
        .filter((widget): widget is (typeof BOARD_WIDGET_CATALOG)[number] => Boolean(widget)),
    [preferences.boardWidgetIds],
  )

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

  useEffect(() => {
    void loadProductPreferences().then(value => {
      if (value.boardWidgetIds.length === 0) {
        void patchProductPreferences({
          boardWidgetIds: [
            'tasks',
            'calendar',
            'gaia-briefing',
            'dimon-activity',
            'nft-entitlements',
            'notes',
            'crm',
          ],
        })
      }
    })
  }, [])

  const pinnedSpaces = useMemo(
    () => ALL_PINNED_SPACES.filter(space => pinnedIds.includes(space.id)),
    [pinnedIds],
  )

  const loading = discoverQuery.isLoading && activityQuery.isLoading
  const focusQuiet = preferences.focus.quietFeed
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

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
      <SecondaryScreenHeader
        title="Board"
        right={
          <ModulaMenu
            accessibilityLabel="Board layout menu"
            title="Board"
            actions={[
              {id: 'customize', label: 'Customize pinned spaces'},
              {id: 'marketplace', label: 'Open Marketplace'},
              {id: 'saved', label: 'Open Saved'},
              {id: 'compose', label: 'Quick compose'},
            ]}
            onAction={id => {
              if (id === 'customize') setCustomizeOpen(true)
              if (id === 'marketplace') router.push('/marketplace' as Href)
              if (id === 'saved') router.push('/saved' as Href)
              if (id === 'compose') router.push('/compose' as Href)
            }}
            trigger={<AppIcon name="more" colour={colours.textSecondary} />}
          />
        }
      />
      <ResponsiveContent maxWidth={760}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            {gap: spacing[5], paddingBottom: tabPadding},
          ]}
          keyboardShouldPersistTaps="handled">
          <View style={{gap: spacing[2]}}>
            <AppText variant="display">Good focus, {ownerName}</AppText>
            <AppText variant="body" colour="textSecondary">
              Board is your private operating dashboard — modules, widgets, and next actions in one
              place.
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
              <AppText variant="headline">
                {focusHalo
                  ? `Focus · ${focusPresetTitle}`
                  : focusPreset === 'off'
                    ? 'Focus Off'
                    : 'Current focus'}
              </AppText>
              <AppText variant="body" colour="textSecondary">
                {focusQuiet
                  ? 'BoardFocusAdapter prioritises work. Feed noise is quieted where the preset allows.'
                  : 'Shape your Profile-OS, install modules, and keep the shell light via the Registry.'}
              </AppText>
              <View style={{gap: spacing[2]}}>
                <AppPressable
                  accessibilityLabel="Open Profile-OS pre-screen"
                  onPress={() => router.push('/profile/os' as Href)}>
                  <AppText variant="caption" colour="accent">
                    Explore Profile-OS →
                  </AppText>
                </AppPressable>
                <AppPressable
                  accessibilityLabel="Open Focus Mode"
                  onPress={() => router.push('/product/focus' as Href)}>
                  <AppText variant="caption" colour="accent">
                    Focus Mode →
                  </AppText>
                </AppPressable>
                <AppPressable
                  accessibilityLabel="Open Product Hub"
                  onPress={() => router.push('/product' as Href)}>
                  <AppText variant="caption" colour="accent">
                    All capabilities →
                  </AppText>
                </AppPressable>
              </View>
            </View>
          </Surface>

          <View style={{gap: spacing[3]}}>
            <View style={styles.sectionHeader}>
              <AppText variant="headline">Widgets</AppText>
              <AppPressable
                accessibilityLabel="Manage widgets"
                onPress={() => router.push('/product/widgets' as Href)}>
                <AppText variant="caption" colour="accent">
                  Manage
                </AppText>
              </AppPressable>
            </View>
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
                      <AppIcon name={widget.icon} colour={colours.accent} />
                      <AppText variant="headline">{widget.name}</AppText>
                      <AppText variant="caption" colour="textTertiary">
                        {widget.size} · {widget.status} · #{index + 1}
                      </AppText>
                      <AppText variant="caption" colour="textSecondary" numberOfLines={3}>
                        {widget.description}
                      </AppText>
                    </Surface>
                  </ModulaContextMenu>
                ))}
              </View>
            )}
          </View>

          <View style={[styles.quickRow, {gap: spacing[2]}]}>
            {[
              {label: 'Widgets', route: '/product/widgets'},
              {label: 'Automations', route: '/product/automations'},
              {label: 'Merge Feeds', route: '/product/merge-feeds'},
              {label: 'Forge', route: '/product/forge'},
              {label: 'Gaia', route: '/product/gaia'},
            ].map(item => (
              <AppPressable
                key={item.route}
                accessibilityLabel={item.label}
                onPress={() => router.push(item.route as Href)}
                style={[
                  styles.quickChip,
                  {
                    backgroundColor: colours.surface,
                    borderColor: colours.border,
                    borderRadius: radius.round,
                    paddingHorizontal: spacing[3],
                    paddingVertical: spacing[2],
                  },
                ]}>
                <AppText variant="caption">{item.label}</AppText>
              </AppPressable>
            ))}
          </View>

          <View style={{gap: spacing[3]}}>
            <View style={styles.sectionHeader}>
              <AppText variant="headline">Pinned spaces</AppText>
              <AppPressable
                accessibilityLabel="Customize pinned spaces"
                onPress={() => setCustomizeOpen(true)}
                style={styles.customizeHit}>
                <AppText variant="caption" colour="accent">
                  Customize
                </AppText>
              </AppPressable>
            </View>
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
                <AppIcon name="board" colour={colours.accent} size={28} />
                <AppText variant="headline">Pin your daily surfaces</AppText>
                <AppText variant="body" colour="textSecondary">
                  Board stays empty until you choose spaces — Marketplace, Saved, Lists, and more.
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
                      <AppIcon name={space.icon} colour={colours.accent} />
                      <View style={{gap: spacing[1]}}>
                        <AppText variant="headline">{space.label}</AppText>
                        <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
                          {space.description}
                        </AppText>
                      </View>
                    </AppPressable>
                  </ModulaContextMenu>
                ))}
              </View>
            )}
          </View>

          <FeatureErrorBoundary label="Board module grid">
            <View style={{gap: spacing[3]}}>
              <View style={styles.sectionHeader}>
                <AppText variant="headline">Modules</AppText>
                <AppPressable
                  accessibilityLabel="Browse marketplace modules"
                  onPress={() => router.push('/marketplace' as Href)}>
                  <AppText variant="caption" colour="accent">
                    Browse
                  </AppText>
                </AppPressable>
              </View>
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
                  <AppIcon name="modules" colour={colours.accent} size={28} />
                  <AppText variant="headline">Install your first capability</AppText>
                  <AppText variant="body" colour="textSecondary">
                    Modules like Vault Notes, Tasks, and CRM ship as packages — preview them in the
                    Marketplace before Registry install lands.
                  </AppText>
                  <AppPressable
                    accessibilityLabel="Open Marketplace"
                    onPress={() => router.push('/marketplace' as Href)}>
                    <AppText variant="label" colour="accent">
                      Open Marketplace
                    </AppText>
                  </AppPressable>
                </Surface>
              ) : null}
              <View style={[styles.moduleGrid, {gap: spacing[3]}]}>
                {modules.map(module => (
                  <View key={module.id} style={styles.moduleCardWrap}>
                    <AppPressable
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
                        <AppText variant="caption" colour="textSecondary" numberOfLines={2}>
                          {module.description}
                        </AppText>
                      </View>
                      <AppText variant="caption" colour="accent">
                        {module.status}
                      </AppText>
                    </AppPressable>
                    <View style={styles.controlGroup}>
                      <ModulaControlGroup
                        label="Module"
                        actions={[
                          {id: 'open', label: 'Open', systemImage: 'arrow.up.right'},
                          {id: 'preview', label: 'Preview', systemImage: 'eye'},
                          {id: 'pin', label: 'Pin', systemImage: 'pin'},
                        ]}
                        onAction={id => {
                          if (id === 'open' || id === 'preview') {
                            router.push(`/marketplace/${module.id}` as Href)
                          }
                        }}
                      />
                    </View>
                  </View>
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

      <ModulaSheet
        isPresented={customizeOpen}
        onDismiss={() => setCustomizeOpen(false)}
        snapPoints={[{fraction: 0.65}, 'full']}
        testID="board-customize-sheet">
        <View style={{gap: spacing[3]}}>
          <AppText variant="headline">Customize pinned spaces</AppText>
          <AppText variant="caption" colour="textSecondary">
            Toggle which spaces appear on your Board. Local only.
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
                    backgroundColor: pinned ? colours.accentSubtle : colours.surfaceRaised,
                    borderRadius: radius.medium,
                  },
                ]}>
                <AppIcon name={space.icon} colour={colours.accent} />
                <View style={styles.focusBody}>
                  <AppText variant="label">{space.label}</AppText>
                  <AppText variant="caption" colour="textSecondary">
                    {space.description}
                  </AppText>
                </View>
                <AppText variant="caption" colour={pinned ? 'accent' : 'textSecondary'}>
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
  quickRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quickChip: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  widgetCard: {
    borderWidth: StyleSheet.hairlineWidth,
    flexGrow: 1,
    minWidth: 140,
  },
  controlGroup: {
    marginTop: 8,
  },
  customizeHit: {
    justifyContent: 'center',
    minHeight: 32,
  },
  customizeRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 12,
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
