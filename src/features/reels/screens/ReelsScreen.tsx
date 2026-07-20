import {useCallback, useMemo, useState} from 'react'
import {
  Alert,
  FlatList,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewToken,
} from 'react-native'
import {LinearGradient} from 'expo-linear-gradient'
import {Stack, useRouter, type Href} from 'expo-router'
import {useSafeAreaInsets} from 'react-native-safe-area-context'

import {InitialLoadingState, QueryErrorState} from '@/components/data'
import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import {ChromeCircleButton} from '@/components/primitives/ChromeCircleButton'
import {FeatureErrorBoundary} from '@/components/system/FeatureErrorBoundary'
import {useSession} from '@/auth/runtime'
import type {ModulaProfile} from '@/features/profile/contracts'
import {getProfileRouteForIdentity} from '@/features/profile/navigation/openProfile'
import {ReelAuthorPeekSheet} from '@/features/reels/components/ReelAuthorPeekSheet'
import {
  ReelsModeSwitcher,
  type ReelsFeedMode,
} from '@/features/reels/components/ReelsModeSwitcher'
import {useReelsQuery} from '@/features/reels/data'
import {
  buildReelHeaderFilterActions,
  buildReelHeaderMoreActions,
  buildReelOverflowActions,
  runReelChromeAction,
  runReelOverflowAction,
  type ReelOverflowActionId,
} from '@/features/reels/reelActions'
import {selectionHaptic} from '@/lib/haptics'
import {ChromeIconMenu} from '@/platform/ui/menus/chrome-icon-menu'
import {ModulaContextMenu} from '@/platform/ui/menus/modula-context-menu'
import {ModulaMenu} from '@/platform/ui/menus/modula-menu'
import {useFloatingTabBarContentPadding} from '@/platform/ui/navigation/floating-tab-bar-inset'
import {
  plainHeaderCustomItem,
  plainHeaderSpacing,
  supportsPlainHeaderItems,
} from '@/platform/ui/navigation/plain-header-items'
import {ModulaReelPlayer} from '@/platform/ui/video'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'
import type {ReelItem as ReelItemType} from '@/domain/discovery'

export function ReelsScreen() {
  const router = useRouter()
  const {height, width} = useWindowDimensions()
  const tabPadding = useFloatingTabBarContentPadding()
  const reelsQuery = useReelsQuery()
  const session = useSession()
  const ownerProfileId = session.status === 'signedIn' ? session.profile.id : ''
  const [activeId, setActiveId] = useState<string | null>(null)
  const [peekAuthor, setPeekAuthor] = useState<ModulaProfile | null>(null)
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => new Set())
  const [mode, setMode] = useState<ReelsFeedMode>('reels')

  const handleViewable = useCallback(
    ({viewableItems}: {viewableItems: ViewToken[]}) => {
      const first = viewableItems.find(item => item.isViewable)
      const id =
        typeof first?.item === 'object' && first.item && 'id' in first.item
          ? String((first.item as ReelItemType).id)
          : null
      setActiveId(id)
    },
    [],
  )
  const viewabilityConfig = useMemo(
    () => ({itemVisiblePercentThreshold: 70}),
    [],
  )

  const allVisible = useMemo(
    () => (reelsQuery.data ?? []).filter(reel => !hiddenIds.has(reel.id)),
    [hiddenIds, reelsQuery.data],
  )

  const friendFaces = useMemo(() => {
    const seen = new Set<string>()
    const faces: ModulaProfile[] = []
    for (const reel of allVisible) {
      if (!reel.author.isFollowing || seen.has(reel.author.id)) continue
      seen.add(reel.author.id)
      faces.push(reel.author)
      if (faces.length >= 3) break
    }
    return faces
  }, [allVisible])

  const visibleReels = useMemo(() => {
    if (mode !== 'friends') return allVisible
    return allVisible.filter(reel => reel.author.isFollowing)
  }, [allVisible, mode])

  const goBack = () => {
    if (router.canGoBack()) {
      router.back()
    } else {
      router.replace('/(tabs)' as never)
    }
  }

  const runChrome = (id: string) => {
    runReelChromeAction(id, {
      onToggleFriends: () => {
        setMode(current => (current === 'friends' ? 'reels' : 'friends'))
      },
      onGoBack: goBack,
      onPolitical: () => router.push('/reels/algorithm' as Href),
      onSensitive: () => router.push('/reels/algorithm' as Href),
    })
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen
        options={{
          title: '',
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          headerBackVisible: false,
          headerTitleAlign: 'center',
          headerTitle: () => (
            <ReelsModeSwitcher
              mode={mode}
              onChange={setMode}
              friendFaces={friendFaces}
            />
          ),
          headerLeft: () => (
            <ChromeCircleButton
              icon="create"
              accessibilityLabel="Create"
              onPress={() => router.push('/compose' as Href)}
            />
          ),
          headerRight: () => (
            <View style={styles.headerSideEnd}>
              <ChromeIconMenu
                systemImage="ellipsis"
                icon="more"
                accessibilityLabel="Reels options"
                title="Reels"
                actions={buildReelHeaderMoreActions()}
                onAction={runChrome}
              />
              <ChromeIconMenu
                systemImage="line.3.horizontal.decrease"
                icon="settings"
                accessibilityLabel="Reels filters"
                title="Filters"
                actions={buildReelHeaderFilterActions(mode)}
                onAction={runChrome}
              />
            </View>
          ),
          ...(supportsPlainHeaderItems()
            ? {
                unstable_headerLeftItems: () => [
                  plainHeaderCustomItem(
                    <ChromeCircleButton
                      icon="create"
                      accessibilityLabel="Create"
                      onPress={() => router.push('/compose' as Href)}
                    />,
                  ),
                ],
                unstable_headerRightItems: () => [
                  plainHeaderCustomItem(
                    <ChromeIconMenu
                      systemImage="ellipsis"
                      icon="more"
                      accessibilityLabel="Reels options"
                      title="Reels"
                      actions={buildReelHeaderMoreActions()}
                      onAction={runChrome}
                    />,
                  ),
                  plainHeaderSpacing(),
                  plainHeaderCustomItem(
                    <ChromeIconMenu
                      systemImage="line.3.horizontal.decrease"
                      icon="settings"
                      accessibilityLabel="Reels filters"
                      title="Filters"
                      actions={buildReelHeaderFilterActions(mode)}
                      onAction={runChrome}
                    />,
                  ),
                ],
              }
            : null),
          headerStyle: {backgroundColor: 'transparent'},
        }}
      />
      <FeatureErrorBoundary label="Reels">
        {reelsQuery.isLoading ? (
          <InitialLoadingState label="Loading reels" />
        ) : reelsQuery.isError ? (
          <QueryErrorState
            error={reelsQuery.error}
            onRetry={() => void reelsQuery.refetch()}
          />
        ) : visibleReels.length === 0 ? (
          <View style={styles.empty}>
            <AppText variant="headline" style={{color: '#fff'}}>
              {mode === 'friends' ? 'No friend reels yet' : 'No reels'}
            </AppText>
            <AppText variant="caption" style={{color: 'rgba(255,255,255,0.7)'}}>
              {mode === 'friends'
                ? 'Follow creators to fill Friends — or switch back to Reels.'
                : 'Pull to refresh once the reels API returns items.'}
            </AppText>
            {mode === 'friends' ? (
              <AppPressable
                accessibilityLabel="Show all reels"
                onPress={() => setMode('reels')}
                style={styles.emptyAction}>
                <AppText variant="label" style={{color: '#fff'}}>
                  Show all reels
                </AppText>
              </AppPressable>
            ) : null}
          </View>
        ) : (
          <FlatList
            data={visibleReels}
            keyExtractor={item => item.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            onViewableItemsChanged={handleViewable}
            viewabilityConfig={viewabilityConfig}
            renderItem={({item}) => (
              <ReelItem
                reel={item}
                height={height}
                width={width}
                bottomInset={tabPadding}
                ownerProfileId={ownerProfileId}
                active={
                  activeId === item.id ||
                  (activeId === null && item.id === visibleReels[0]?.id)
                }
                onOpenAuthorPeek={setPeekAuthor}
                onHideReel={id => {
                  setHiddenIds(prev => new Set(prev).add(id))
                }}
              />
            )}
          />
        )}
      </FeatureErrorBoundary>

      <ReelAuthorPeekSheet
        author={peekAuthor}
        ownerProfileId={ownerProfileId}
        isPresented={peekAuthor != null}
        onDismiss={() => setPeekAuthor(null)}
      />
    </View>
  )
}

function ReelItem({
  reel,
  height,
  width,
  bottomInset,
  active,
  ownerProfileId,
  onOpenAuthorPeek,
  onHideReel,
}: {
  reel: ReelItemType
  height: number
  width: number
  bottomInset: number
  active: boolean
  ownerProfileId: string
  onOpenAuthorPeek: (author: ModulaProfile) => void
  onHideReel: (id: string) => void
}) {
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const [liked, setLiked] = useState(reel.liked)
  const [saved, setSaved] = useState(false)
  const {colours, spacing} = useThemeTokens()
  const profileRoute = getProfileRouteForIdentity(reel.author, ownerProfileId)
  const likeCount = reel.likeCount + (liked && !reel.liked ? 1 : 0)
  const overflowActions = buildReelOverflowActions(reel)

  const handleOverflow = (id: string) => {
    const actionId = id as ReelOverflowActionId
    void runReelOverflowAction(actionId, reel, ownerProfileId).then(() => {
      if (actionId === 'notInterested' || actionId === 'seeLess') {
        onHideReel(reel.id)
      }
    })
  }

  const actions: {
    label: string
    icon: AppIconName
    action: 'like' | 'reply' | 'share' | 'save' | 'more'
    count?: number
  }[] = [
    {label: 'Like', icon: 'like', action: 'like', count: likeCount},
    {
      label: 'Comments',
      icon: 'comment',
      action: 'reply',
      count: reel.replyCount,
    },
    {label: 'Share', icon: 'share', action: 'share'},
    {label: saved ? 'Saved' : 'Save', icon: 'saved', action: 'save'},
    {label: 'More options', icon: 'more', action: 'more'},
  ]

  const runAction = (action: Exclude<(typeof actions)[number]['action'], 'more'>) => {
    void selectionHaptic()
    switch (action) {
      case 'like':
        setLiked(value => !value)
        return
      case 'reply':
        Alert.alert(
          'Comments (Preview)',
          reel.replyCount > 0
            ? `${reel.replyCount} replies on this reel. Full threaded comments land with the reels engagement API.`
            : 'No replies yet. Threaded comments land with the reels engagement API.',
        )
        return
      case 'share':
        void runReelOverflowAction('share', reel, ownerProfileId)
        return
      case 'save':
        setSaved(value => {
          const next = !value
          if (next) {
            Alert.alert(
              'Saved (Preview)',
              'Saved reels will sync once collections land. Local preview only.',
            )
          }
          return next
        })
        return
      default:
        return
    }
  }

  const moreTrigger = (
    <View style={styles.railHit}>
      <AppIcon name="more" colour={colours.mediaOverlayIcon} size={22} />
    </View>
  )

  return (
    <View style={[styles.item, {height, width, backgroundColor: colours.surface1}]}>
      <View style={[styles.mediaHost, {width, height}]}>
        <ModulaContextMenu
          accessibilityLabel={`Reel options for @${reel.author.handle}`}
          title="Reel options"
          actions={overflowActions}
          onAction={handleOverflow}>
          <View style={{width, height}}>
            {reel.videoUri ? (
              <ModulaReelPlayer
                sourceUri={reel.videoUri}
                posterColour={reel.colour}
                active={active}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <LinearGradient
                colors={[colours.surface1, reel.colour, colours.surface3]}
                locations={[0, 0.45, 1]}
                start={{x: 0.15, y: 0}}
                end={{x: 0.9, y: 1}}
                style={StyleSheet.absoluteFill}
              />
            )}
          </View>
        </ModulaContextMenu>
      </View>

      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {backgroundColor: colours.mediaOverlayScrim}]}
      />

      <View
        pointerEvents="box-none"
        style={[
          styles.bottomRow,
          {
            paddingBottom: Math.max(bottomInset, insets.bottom, spacing[4]),
            paddingHorizontal: spacing[4],
            gap: spacing[3],
          },
        ]}>
        <View pointerEvents="box-none" style={[styles.caption, {gap: spacing[2]}]}>
          <AppPressable
            accessibilityLabel={`Open ${reel.author.displayName} profile. Long press for preview.`}
            onPress={() => router.push(profileRoute)}
            onLongPress={() => {
              void selectionHaptic()
              onOpenAuthorPeek(reel.author)
            }}
            delayLongPress={280}
            style={styles.creator}>
            <Avatar
              name={reel.author.displayName}
              uri={reel.author.avatarUri}
              colour={reel.author.coverColour}
              size={36}
            />
            <View style={styles.creatorText}>
              <AppText
                variant="headline"
                style={{color: colours.mediaOverlayText}}
                numberOfLines={1}>
                {reel.author.displayName}
              </AppText>
              <AppText
                variant="caption"
                style={{color: colours.mediaOverlaySecondary}}
                numberOfLines={1}>
                @{reel.author.handle}
              </AppText>
            </View>
          </AppPressable>
          <AppText
            pointerEvents="none"
            variant="body"
            style={{color: colours.mediaOverlayText}}>
            {reel.caption}
          </AppText>
          <AppText
            pointerEvents="none"
            variant="caption"
            style={{color: colours.mediaOverlaySecondary}}>
            Preview · {reel.source}
            {reel.videoUri ? ' · video foundation' : ''}
          </AppText>
        </View>

        <View pointerEvents="box-none" style={[styles.rail, {gap: spacing[3]}]}>
          {actions.map(action => (
            <View key={action.action} style={styles.railItem}>
              {action.action === 'more' ? (
                <ModulaMenu
                  accessibilityLabel={action.label}
                  title="Reel options"
                  actions={overflowActions}
                  onAction={handleOverflow}
                  trigger={moreTrigger}
                />
              ) : (
                <AppPressable
                  accessibilityLabel={action.label}
                  accessibilityState={{
                    selected:
                      action.action === 'like'
                        ? liked
                        : action.action === 'save'
                          ? saved
                          : undefined,
                  }}
                  onPress={() => {
                    if (action.action !== 'more') runAction(action.action)
                  }}
                  style={styles.railHit}>
                  <AppIcon
                    name={action.icon}
                    colour={
                      (action.action === 'like' && liked) ||
                      (action.action === 'save' && saved)
                        ? colours.accent
                        : colours.mediaOverlayIcon
                    }
                    size={22}
                  />
                </AppPressable>
              )}
              {typeof action.count === 'number' ? (
                <AppText
                  variant="caption"
                  style={{
                    color: colours.mediaOverlayText,
                    fontVariant: ['tabular-nums'],
                  }}>
                  {action.count}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  bottomRow: {
    alignItems: 'flex-end',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    zIndex: 3,
  },
  caption: {
    flex: 1,
    minWidth: 0,
  },
  creator: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  creatorText: {
    flex: 1,
    minWidth: 0,
  },
  empty: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  emptyAction: {
    marginTop: 8,
    padding: 12,
  },
  headerSideEnd: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 22,
    paddingRight: 4,
  },
  item: {
    overflow: 'hidden',
  },
  mediaHost: {
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  rail: {
    alignItems: 'center',
  },
  railHit: {
    alignItems: 'center',
    height: 44,
    justifyContent: 'center',
    minWidth: 44,
  },
  railItem: {
    alignItems: 'center',
    gap: 4,
  },
  screen: {
    backgroundColor: '#000',
    flex: 1,
  },
})
