import {useEffect, useMemo, useState} from 'react'
import {
  LayoutAnimation,
  Platform,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from 'react-native'
import {useRouter, type Href} from 'expo-router'

import {QueryErrorState} from '@/components/data'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {EmptyState} from '@/components/primitives/EmptyState'
import {Pill} from '@/components/primitives/Pill'
import {Surface} from '@/components/primitives/Surface'
import {useSession} from '@/auth/runtime'
import {ActivityDigestStrip} from '@/features/activity/components/ActivityDigestStrip'
import {useActivityQuery} from '@/features/activity/data'
import {isBlockOn} from '@/features/product/data/layoutBlocks'
import {useProductPreferences} from '@/features/product/hooks/useProductPreferences'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {useReduceMotion} from '@/lib/accessibility'
import {selectionHaptic} from '@/lib/haptics'
import {StackedAvatars} from '@/platform/ui/avatars'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ChromeOverflowMenu} from '@/platform/ui/menus/chrome-overflow-menu'
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
  const router = useRouter()
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

  useEffect(() => {
    if (!reduceMotion) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    }
  }, [filter, reduceMotion])

  if (activityQuery.isLoading) {
    return (
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
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
      <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
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

  const markAllRead = () => {
    setReadIds(new Set(activity.map(item => item.id)))
    void selectionHaptic()
    void activityRepository.markAllRead().catch(() => undefined)
  }

  return (
    <View style={[styles.screen, {backgroundColor: colours.canvas}]}>
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
          <View style={styles.titleRow}>
            <AppPressable
              accessibilityLabel="Mark all as read"
              onPress={markAllRead}
              style={styles.iconHit}>
              <AppIcon name="check" colour={colours.textSecondary} />
            </AppPressable>
            <View style={styles.titleActions}>
              <AppPressable
                accessibilityLabel="Filter activity"
                onPress={() => setFilterSheetOpen(true)}
                style={styles.iconHit}>
                <AppIcon name="settings" colour={colours.textSecondary} />
              </AppPressable>
              <ChromeOverflowMenu
                accessibilityLabel="More activity actions"
                title="Activity"
                actions={[
                  {id: 'notifications', label: 'Notification settings'},
                  {id: 'markRead', label: 'Mark all as read'},
                  {id: 'filter', label: 'Open filters'},
                  {id: 'customize', label: 'Customize Activity'},
                  {id: 'quiet', label: 'Quiet inbox'},
                ]}
                onAction={id => {
                  if (id === 'notifications') {
                    router.push('/settings/notifications' as Href)
                  }
                  if (id === 'markRead') markAllRead()
                  if (id === 'filter') setFilterSheetOpen(true)
                  if (id === 'customize') router.push('/product/layout-activity' as Href)
                  if (id === 'quiet') router.push('/product/quiet-inbox' as Href)
                }}
              />
            </View>
          </View>

          {showBlock('filter-pills') ? (
            <SectionEnter delay={20} from="right">
              <View style={{flexDirection: 'row', gap: spacing[2]}}>
                <Pill label="All" selected={filter === 'all'} onPress={() => applyFilter('all')} />
                <Pill label="Replies" selected={filter === 'replies'} onPress={() => applyFilter('replies')} />
                <Pill label="Mentions" selected={filter === 'mentions'} onPress={() => applyFilter('mentions')} />
                <Pill
                  label="Filters"
                  selected={
                    filter !== 'all' && filter !== 'mentions' && filter !== 'replies'
                  }
                  onPress={() => setFilterSheetOpen(true)}
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
                <AppText variant="headline">{group}</AppText>
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
                  borderRadius: 12,
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
  highlightUnread,
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
      router.push('/marketplace/module-vault-notes' as Href)
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
        {id: 'markRead', label: unread ? 'Mark as read' : 'Mark as unread'},
        {id: 'mute', label: 'Mute preview'},
        {id: 'copy', label: 'Copy text'},
        {id: 'remove', label: 'Remove preview', style: 'destructive'},
      ]}
      onAction={id => {
        if (id === 'open') openDestination()
        if (id === 'markRead') onMarkRead()
        if (id === 'copy' && item.description) {
          void import('expo-clipboard').then(mod =>
            mod.setStringAsync(
              item.actor
                ? `${item.actor.displayName} ${item.description}`
                : item.description,
            ),
          )
        }
      }}>
      <AppPressable
        accessibilityLabel={item.description}
        onPress={openDestination}
        style={styles.rowPress}>
        <Surface
          variant="plain"
          style={[
            styles.row,
            {
              backgroundColor:
                unread && highlightUnread ? colours.surfaceRaised : 'transparent',
              borderRadius: radius.xlarge,
              gap: spacing[3],
              opacity: unread ? 1 : 0.72,
              paddingHorizontal: spacing[2],
              paddingVertical: spacing[2],
            },
          ]}>
          {item.actor && profileRoute ? (
            <View>
              <Avatar
                name={item.actor.displayName}
                uri={item.actor.avatarUri}
                colour={item.actor.coverColour}
                size={42}
              />
              {unread ? (
                <View
                  style={[
                    styles.unreadDot,
                    {backgroundColor: colours.accent, borderColor: colours.canvas},
                  ]}
                />
              ) : null}
            </View>
          ) : (
            <View
              style={[
                styles.iconAvatar,
                {
                  backgroundColor: colours.accentSubtle,
                  borderRadius: radius.round,
                },
              ]}>
              <AppIcon name={item.icon ?? 'activity'} colour={colours.accent} />
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
        </Surface>
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
    paddingHorizontal: 14,
  },
  iconAvatar: {
    alignItems: 'center',
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  iconHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  preview: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    width: '100%',
  },
  rowPress: {
    width: '100%',
  },
  screen: {
    flex: 1,
  },
  titleActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
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
