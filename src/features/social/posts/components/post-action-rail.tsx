import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {Platform, StyleSheet, View} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import {GestureDetector} from 'react-native-gesture-handler'
import * as Haptics from 'expo-haptics'

import {AppIcon, type AppIconName} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import type {ReactionType, SocialPost} from '@/domain/social'
import {PostCounter} from '@/features/social/posts/components/post-counter'
import {PostSurface} from '@/features/social/posts/components/post-surface'
import {
  postSpringConfig,
  usePostInteraction,
} from '@/features/social/posts/interactions/post-interaction-context'
import {createRailPan} from '@/features/social/posts/interactions/post-ui-worklets'
import {PostContextMenu} from '@/features/social/posts/interactions/post-context-menu'
import {ReactionPicker} from '@/features/social/posts/interactions/reaction-picker'
import {
  canOpenContext,
  canStartReaction,
} from '@/features/social/posts/state/post-interaction-machine'
import type {PostContextAction} from '@/features/social/posts/state/post-interaction-types'
import {POST_GEOMETRY} from '@/features/social/posts/tokens/post-geometry'
import {POST_MOTION} from '@/features/social/posts/tokens/post-motion'
import {postLayerZ} from '@/features/social/posts/tokens/post-layout'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PostActionRailProps = {
  post: SocialPost
  contextActions: PostContextAction[]
  onReact: (reaction: ReactionType | null) => void
  onSave: () => void
  onShare: () => void
  onCommentPress: () => void
}

function RailButton({
  label,
  icon,
  selected,
  count,
  onPress,
  onLongPress,
  compact,
}: {
  label: string
  icon: AppIconName
  selected?: boolean
  count?: number
  onPress: () => void
  onLongPress?: () => void
  compact?: boolean
}) {
  const {colours} = useThemeTokens()
  const ink = selected && icon === 'like' ? colours.destructive : colours.mediaOverlayIcon

  return (
    <AppPressable
      accessibilityLabel={label}
      accessibilityState={{selected}}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={POST_MOTION.reactionHoldMs}
      style={[
        styles.railButton,
        {
          backgroundColor: colours.mediaOverlayControlBackground,
          borderColor: colours.borderStrong,
        },
      ]}>
      <AppIcon name={icon} colour={ink} size={compact ? 22 : 24} />
      {typeof count === 'number' && count > 0 ? (
        <PostCounter value={count} selected={selected} overlay />
      ) : null}
    </AppPressable>
  )
}

export function PostActionRail({
  post,
  contextActions,
  onReact,
  onSave,
  onShare,
  onCommentPress,
}: PostActionRailProps) {
  const {colours} = useThemeTokens()
  const {
    railProgress,
    commentsProgress,
    mode,
    reduceMotion,
    setMode,
  } = usePostInteraction()
  const [customOpen, setCustomOpen] = useState(false)
  const returnFocus = useRef<{focus?: () => void} | null>(null)
  const liked = Boolean(post.liked || post.viewerReaction)
  const currentReaction = post.viewerReaction ?? (post.liked ? 'like' : null)

  const hapticLight = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
  }
  const hapticSelection = () => {
    void Haptics.selectionAsync().catch(() => undefined)
  }

  const railPan = useMemo(
    () =>
      createRailPan({
        railProgress,
        enabled: canOpenContext(mode),
        setMode,
        onCommitHaptic: hapticSelection,
        onOpenHaptic: hapticLight,
      }),
    [mode, railProgress, setMode],
  )

  const railStyle = useAnimatedStyle(() => {
    const p = railProgress.get()
    const comments = commentsProgress.get()
    const width = interpolate(
      p,
      [0, 0.45, 1],
      [POST_GEOMETRY.actionRailWidth, POST_GEOMETRY.actionRailWidth + 24, POST_GEOMETRY.contextMenuWidth],
    )
    const radius = interpolate(
      p,
      [0, 1],
      [POST_GEOMETRY.actionRailRadius, POST_GEOMETRY.contextMenuRadius],
    )
    return {
      opacity: 1 - comments * 0.85,
      transform: [{scale: 1 - comments * 0.04}],
      width,
      borderRadius: radius,
    }
  })

  const compactStyle = useAnimatedStyle(() => ({
    opacity: interpolate(railProgress.get(), [0, 0.35, 0.55], [1, 0.4, 0]),
  }))

  const menuStyle = useAnimatedStyle(() => ({
    opacity: interpolate(railProgress.get(), [0.55, 0.85, 1], [0, 0.6, 1]),
    pointerEvents: railProgress.get() > 0.7 ? ('auto' as const) : ('none' as const),
  }))

  const restoreFocus = useCallback(() => {
    if (Platform.OS === 'web') {
      setTimeout(() => returnFocus.current?.focus?.(), 0)
    }
  }, [])

  const closeContext = useCallback(() => {
    setMode('idle')
    railProgress.set(withSpring(0, postSpringConfig('rail')))
    restoreFocus()
  }, [railProgress, restoreFocus, setMode])

  const openContext = () => {
    if (!canOpenContext(mode)) return
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      returnFocus.current = document.activeElement as {focus?: () => void}
    }
    setMode('contextOpen')
    railProgress.set(withSpring(1, postSpringConfig('rail')))
  }

  useEffect(() => {
    if (mode !== 'contextOpen' || Platform.OS !== 'web' || typeof document === 'undefined') return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeContext()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [closeContext, mode])

  const openReaction = () => {
    if (!canStartReaction(mode)) return
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      returnFocus.current = document.activeElement as {focus?: () => void}
    }
    if (reduceMotion) {
      setMode('reactionSelecting')
      return
    }
    setMode('reactionHolding')
    setMode('reactionSelecting')
  }

  const reactionOpen = mode === 'reactionHolding' || mode === 'reactionSelecting'
  const contextVisible = mode === 'railDragging' || mode === 'contextOpen'
  const commentsOpen = mode === 'commentsDragging' || mode === 'commentsPeek' || mode === 'commentsPartial' || mode === 'commentsFull'

  return (
    <>
      <GestureDetector gesture={railPan}>
        <Animated.View
          pointerEvents={commentsOpen ? 'none' : 'auto'}
          style={[
            styles.railAnchor,
            railStyle,
            {zIndex: postLayerZ('interaction')},
          ]}>
          <View style={styles.grabber} pointerEvents="none">
            <View style={[styles.grabberLine, {backgroundColor: colours.mediaOverlaySecondary}]} />
          </View>
          <PostSurface role="rail" style={styles.railSurface}>
            <Animated.View style={[styles.compactColumn, compactStyle]}>
              <RailButton
                compact
                label="Open post menu"
                icon="more"
                onPress={openContext}
              />
              <View style={styles.reactionControl}>
                <RailButton
                  label={liked ? 'Unlike' : 'Like'}
                  icon="like"
                  selected={liked}
                  count={post.likeCount || undefined}
                  onPress={() => onReact(currentReaction === 'like' ? null : 'like')}
                  onLongPress={openReaction}
                />
                {Platform.OS === 'web' ? (
                  <AppPressable
                    accessibilityLabel="Choose reaction"
                    onPress={openReaction}
                    style={[
                      styles.reactionMore,
                      {backgroundColor: colours.mediaOverlayControlBackground, borderColor: colours.borderStrong},
                    ]}>
                    <AppText variant="label" style={{color: colours.mediaOverlayText}}>＋</AppText>
                  </AppPressable>
                ) : null}
              </View>
              <RailButton
                label="Comment"
                icon="comment"
                count={post.replyCount || undefined}
                onPress={onCommentPress}
              />
              <RailButton
                label={post.saved ? 'Unsave' : 'Save'}
                icon={post.saved ? 'saved' : 'bookmark'}
                selected={post.saved}
                onPress={onSave}
              />
              <RailButton label="Share" icon="share" count={post.repostCount || undefined} onPress={onShare} />
            </Animated.View>
            <Animated.View style={[styles.menuColumn, menuStyle]}>
              {contextVisible ? (
                <PostSurface role="context" style={styles.menuSurface}>
                  <PostContextMenu actions={contextActions} onClose={closeContext} />
                </PostSurface>
              ) : null}
            </Animated.View>
          </PostSurface>
        </Animated.View>
      </GestureDetector>

      <ReactionPicker
        visible={reactionOpen}
        customOpen={customOpen}
        currentReaction={currentReaction}
        onClose={() => {
          setCustomOpen(false)
          setMode('idle')
          restoreFocus()
        }}
        onOpenCustom={() => setCustomOpen(true)}
        onSelect={reaction => {
          onReact(reaction)
          setCustomOpen(false)
          setMode('idle')
          restoreFocus()
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  compactColumn: {
    alignItems: 'center',
    gap: 6,
  },
  grabber: {
    alignItems: 'center',
    height: 18,
    justifyContent: 'center',
    left: -POST_GEOMETRY.railGrabWidth,
    position: 'absolute',
    top: '36%',
    width: POST_GEOMETRY.railGrabWidth,
  },
  grabberLine: {
    borderRadius: 2,
    height: 28,
    opacity: 0.55,
    width: 3,
  },
  menuColumn: {
    ...StyleSheet.absoluteFill,
  },
  menuSurface: {flex: 1, paddingHorizontal: 10, paddingVertical: 12},
  railAnchor: {
    bottom: 72,
    position: 'absolute',
    right: POST_GEOMETRY.railInset,
  },
  railButton: {
    alignItems: 'center',
    borderRadius: POST_GEOMETRY.actionButtonSize / 2,
    borderWidth: StyleSheet.hairlineWidth,
    height: POST_GEOMETRY.actionButtonSize,
    justifyContent: 'center',
    width: POST_GEOMETRY.actionButtonSize,
  },
  railSurface: {
    minHeight: 254,
    overflow: 'visible',
  },
  reactionControl: {position: 'relative'},
  reactionMore: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    height: 44,
    justifyContent: 'center',
    left: -42,
    position: 'absolute',
    top: 0,
    width: 36,
  },
})
