import {useCallback, useEffect, useLayoutEffect, useMemo, useState} from 'react'
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from 'react-native'
import {useNavigation, useRouter, type Href} from 'expo-router'

import {QueryErrorState} from '@/components/data'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {useSession} from '@/auth/runtime'
import {ActivityDigestStrip} from '@/features/activity/components/ActivityDigestStrip'
import {useActivityQuery} from '@/features/activity/data'
import {ModulaSegmentedPicker} from '@/platform/ui/controls/modula-segmented-picker'
import {isBlockOn} from '@/features/product/data/layoutBlocks'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {SectionHeader} from '@/platform/ui/chrome/section-header'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {StackedAvatars} from '@/platform/ui/avatars'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {
  ActivityHeaderRight,
} from '@/platform/ui/navigation/activity-stack-header'
import {SectionEnter} from '@/platform/ui/motion/section-enter'
import {useNativeHeaderFadePadding} from '@/platform/ui/navigation/chrome-insets'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {ModulaSheet} from '@/platform/ui/sheets/modula-sheet'
import {ActivityListSkeleton} from '@/platform/ui/skeletons'
import {ResponsiveContent} from '@/shell/ResponsiveContent'
import {useAppServices} from '@/runtime/useAppServices'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {ActivityItem} from '@/domain/activity'

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true)
}

const groups = ['Today', 'This week', 'Earlier'] as const
type ActivityFilter = 'all' | 'replies' | 'mentions' | 'reactions' | 'follows' | 'extensions' | 'system'
const filters: readonly [ActivityFilter, string][] = [
  ['all', 'All'],
  ['replies', 'Replies'],
  ['mentions', 'Mentions'],
  ['reactions', 'Reactions'],
  ['follows', 'Follows'],
  ['extensions', 'Extensions'],
  ['system', 'System'],
]

function matchesFilter(item: ActivityItem, filter: ActivityFilter): boolean {
  if (filter === 'all') return true
  const types: Record<Exclude<ActivityFilter, 'all'>, ActivityItem['type'][]> = {
    replies: ['reply'],
    mentions: ['mention'],
    reactions: ['reaction', 'like'],
    follows: ['follow'],
    extensions: ['extension', 'moduleUpdate'],
    system: ['system', 'teamInvitation'],
  }
  return types[filter].includes(item.type)
}

export function ActivityScreen() {
  const navigation = useNavigation()
  const {activityRepository} = useAppServices()
  const {colours, spacing} = useThemeTokens()
  const reduceMotion = useReduceMotion()
  const {preferences} = useProductPreferences()
  const tabPadding = useFloatingTabBarContentPadding()
  const fadePad = useNativeHeaderFadePadding()
  const activityQuery = useActivityQuery()
  const [filter, setFilter] = useState<ActivityFilter>('all')
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set())
  const activityPages = activityQuery.data?.pages
  const activity = useMemo(
    () => activityPages?.flatMap(page => page.items) ?? [],
    [activityPages],
  )
  const filtered = useMemo(
    () => activity.filter(item => matchesFilter(item, filter)),
    [activity, filter],
  )
  const showBlock = (id: string) => isBlockOn(preferences.activityBlockIds, id)
  const staggerEnter = showBlock('stagger-enter') && !reduceMotion

  const markAllRead = useCallback(() => {
    setReadIds(new Set(activity.map(item => item.id)))
    void selectionHaptic()
    void activityRepository.markAllRead().catch(() => undefined)
  }, [activity, activityRepository])

  const openFilters = useCallback(() => setFilterSheetOpen(true), [])

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <ActivityHeaderRight
          onMarkRead={markAllRead}
          onOpenFilters={openFilters}
        />
      ),
    })
  }, [markAllRead, navigation, openFilters])

  useEffect(() => {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }
  }, [filter, reduceMotion])

  if (activityQuery.isLoading) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.surfaceMuted}]}>
        <ActivityListSkeleton />
      </View>
    )
  }

  if (activityQuery.isError) {
    return (
      <QueryErrorState
        error={activityQuery.error}
        onRetry={() => void activityQuery.refetch()}
      />
    )
  }

  if (!activity.length) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.surfaceMuted}]}>
        <EmptyState
          icon="activity"
          title="No activity yet"
          description="Local likes, replies, mentions, and module updates will appear here."
        />
      </View>
    )
  }

  const applyFilter = (next: ActivityFilter) => {
    void selectionHaptic()
    setFilter(next)
    setFilterSheetOpen(false)
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.surfaceMuted}]}>
      <ResponsiveContent>
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
          {showBlock('filter-pills') ? (
            <SectionEnter delay={20} from="right">
              <View style={{gap: spacing[2]}}>
                <ModulaSegmentedPicker
                  appearance="segmented"
                  accessibilityLabel="Activity filter"
                  testID="activity-filter-segments"
                  options={[
                    {value: 'all', label: 'All'},
                    {value: 'mentions', label: 'Mentions'},
                    {value: 'extensions', label: 'Modules'},
                  ]}
                  value={
                    filter === 'mentions' || filter === 'extensions' ? filter : 'all'
                  }
                  onValueChange={next => {
                    if (next === 'all' || next === 'mentions' || next === 'extensions') {
                      applyFilter(next)
                    }
                  }}
                />
              </View>
            </SectionEnter>
          ) : null}

          {filter === 'all' && showBlock('digest') ? (
            <ActivityDigestStrip
              items={activity}
              readIds={readIds}
              onMarkAllRead={markAllRead}
            />
          ) : null}

          {filter !== 'all' && filter !== 'mentions' && filter !== 'replies' ? (
            <AppText variant="caption" colour="textSecondary">
              Showing {filter}
            </AppText>
          ) : null}

          {groups.map((group, groupIndex) => {
            const items = filtered.filter(item => item.group === group)
            if (!items.length) return null
            const groupBody = (
              <View style={{gap: spacing[3]}}>
                <SectionHeader title={group} icon="activity" />
                <View style={{gap: spacing[2]}}>
                  {items.map((item, itemIndex) => {
                    const row = (
                      <ActivityRow
                        item={item}
                        unread={!readIds.has(item.id)}
                        highlightUnread={showBlock('unread-cards')}
                        peers={activity.filter(
                          peer =>
                            peer.id !== item.id &&
                            peer.group === item.group &&
                            (peer.type === 'like' || peer.type === 'reaction') &&
                            (item.type === 'like' || item.type === 'reaction'),
                        )}
                        onOpen={() => {
                          setReadIds(prev => new Set(prev).add(item.id))
                          void activityRepository.markRead(item.id).catch(() => undefined)
                        }}
                        onMarkRead={() => {
                          setReadIds(prev => new Set(prev).add(item.id))
                          void activityRepository.markRead(item.id).catch(() => undefined)
                        }}
                      />
                    )
                    if (!staggerEnter) return <View key={item.id}>{row}</View>
                    return (
                      <SectionEnter key={item.id} delay={80 + groupIndex * 40 + itemIndex * 28}>
                        {row}
                      </SectionEnter>
                    )
                  })}
                </View>
              </View>
            )
            if (!staggerEnter) return <View key={group}>{groupBody}</View>
            return (
              <SectionEnter key={group} delay={60 + groupIndex * 50}>
                {groupBody}
              </SectionEnter>
            )
          })}
        </ScrollView>
      </ResponsiveContent>

      <ModulaSheet
        isPresented={filterSheetOpen}
        onDismiss={() => setFilterSheetOpen(false)}
        snapPoints={[{fraction: 0.55}, 'full']}
        testID="activity-filter-sheet">
        <View style={{gap: spacing[3]}}>
          <AppText variant="headline">Filter activity</AppText>
          <AppText variant="caption" colour="textSecondary">
            Filter notifications by type.
          </AppText>
          {filters.map(([id, label]) => (
            <AppPressable
              key={id}
              accessibilityLabel={`Filter ${label}`}
              onPress={() => applyFilter(id)}
              style={[
                styles.filterRow,
                {
                  backgroundColor:
                    filter === id ? colours.accentSubtle : colours.surfaceRaised,
                  borderRadius: radius.medium,
                },
              ]}>
              <AppText
                variant="label"
                style={{color: filter === id ? colours.accent : colours.text}}>
                {label}
              </AppText>
            </AppPressable>
          ))}
        </View>
      </ModulaSheet>
    </View>
  )
}

function ActivityRow({
  item,
  unread,
  highlightUnread: _highlightUnread,
  peers,
  onOpen,
  onMarkRead,
}: {
  item: ActivityItem
  unread: boolean
  highlightUnread: boolean
  peers: ActivityItem[]
  onOpen: () => void
  onMarkRead: () => void
}) {
  const router = useRouter()
  const session = useSession()
  const {colours, radius, spacing} = useThemeTokens()
  const ownerProfileId = session.status === 'signedIn' ? session.profile.id : ''
  const profileRoute = item.actor
    ? getProfileRouteForIdentity(item.actor, ownerProfileId)
    : null

  const multiActors = [item, ...peers]
    .map(entry => entry.actor)
    .filter((actor): actor is NonNullable<typeof actor> => Boolean(actor))
  const uniqueActors = multiActors.filter(
    (actor, index, list) => list.findIndex(face => face.id === actor.id) === index,
  )
  const showStack =
    (item.type === 'like' || item.type === 'reaction' || item.type === 'follow') &&
    uniqueActors.length > 0

  const openDestination = () => {
    onOpen()
    if (item.type === 'moduleUpdate') {
      router.push('/modules' as Href)
      return
    }
    if (item.type === 'teamInvitation') {
      router.push('/teams' as Href)
      return
    }
    if (item.type === 'like' || item.type === 'reply' || item.type === 'mention') {
      router.push('/' as Href)
      return
    }
    if (profileRoute) {
      router.push(profileRoute)
    }
  }

  return (
    <ModulaContextMenu
      accessibilityLabel={`Activity actions for ${item.description}`}
      actions={[
        {id: 'open', label: 'Open'},
        {id: 'markRead', label: unread ? 'Mark as read' : 'Already read'},
      ]}
      onAction={id => {
        if (id === 'open') openDestination()
        if (id === 'markRead') onMarkRead()
      }}>
      <AppPressable
        accessibilityLabel={item.description}
        onPress={openDestination}
        style={styles.rowPress}>
        <View
          style={[
            styles.row,
            {
              borderBottomColor: colours.border,
              gap: spacing[3],
              paddingHorizontal: spacing[3],
              paddingVertical: spacing[3],
            },
          ]}>
          {item.actor && profileRoute ? (
            <View>
              <Avatar
                name={item.actor.displayName}
                uri={item.actor.avatarUri}
                colour={item.actor.coverColour}
                size={48}
              />
              {unread ? (
                <View
                  style={[
                    styles.unreadDot,
                    {backgroundColor: colours.accent, borderColor: colours.surface},
                  ]}
                />
              ) : null}
            </View>
          ) : (
            <View
              style={[
                styles.iconAvatar,
                {
                  backgroundColor: colours.surfaceMuted,
                  borderRadius: radius.round,
                },
              ]}>
              <AppIcon name={item.icon ?? 'activity'} colour={colours.text} />
            </View>
          )}
          <View style={styles.body}>
            {item.actor ? (
              <AppText variant="body">
                <AppText variant="label">
                  {uniqueActors.length > 1
                    ? `${item.actor.displayName} and ${uniqueActors.length - 1} others`
                    : item.actor.displayName}
                </AppText>{' '}
                {item.description}
              </AppText>
            ) : (
              <AppText variant="body">{item.description}</AppText>
            )}
            <AppText variant="caption" colour="textSecondary">
              {item.timestamp}
            </AppText>
            {item.preview ? (
              <View
                style={[
                  styles.preview,
                  {
                    backgroundColor: colours.canvas,
                    borderColor: colours.border,
                    borderRadius: radius.medium,
                    marginTop: spacing[2],
                    padding: spacing[3],
                  },
                ]}>
                <AppText variant="caption" colour="textSecondary">
                  {item.preview}
                </AppText>
              </View>
            ) : null}
            {showStack ? (
              <View style={{marginTop: spacing[2]}}>
                <StackedAvatars
                  faces={uniqueActors.map(actor => ({
                    id: actor.id,
                    name: actor.displayName,
                    uri: actor.avatarUri,
                    colour: actor.coverColour,
                  }))}
                  size={28}
                  max={4}
                />
              </View>
            ) : null}
          </View>
        </View>
      </AppPressable>
    </ModulaContextMenu>
  )
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    minWidth: 0,
  },
  content: {
    padding: 16,
  },
  filterRow: {
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  iconAvatar: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'flex-start',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    width: '100%',
  },
  rowPress: {
    width: '100%',
  },
  screen: {
    flex: 1,
  },
  unreadDot: {
    borderRadius: 5,
    borderWidth: 2,
    bottom: 0,
    height: 10,
    position: 'absolute',
    right: 0,
    width: 10,
  },
})
