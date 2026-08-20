import {useMemo, useState} from 'react'
import {StyleSheet, View} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import {scheduleOnRN} from 'react-native-worklets'
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
import {PostContextMenu} from '@/features/social/posts/interactions/post-context-menu'
import {ReactionPicker} from '@/features/social/posts/interactions/reaction-picker'
import {railReleaseTarget} from '@/features/social/posts/state/post-interaction-machine'
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

const RAIL_DRAG_DISTANCE = 140

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
      style={styles.railButton}>
      <AppIcon name={icon} colour={ink} size={compact ? 22 : 24} />
      {typeof count === 'number' ? (
        <PostCounter value={count} selected={selected} overlay />
      ) : icon === 'bookmark' || icon === 'saved' ? (
        <AppText variant="caption" style={styles.saveLabel}>
          Save
        </AppText>
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
    reduceMotion,
    setMode,
  } = usePostInteraction()
  const [reactionOpen, setReactionOpen] = useState(false)
  const [customOpen, setCustomOpen] = useState(false)
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
      Gesture.Pan()
        .manualActivation(true)
        .onTouchesDown((_e, state) => {
          state.activate()
        })
        .activeOffsetY([8, 9999])
        .failOffsetX([-24, 24])
        .onUpdate(event => {
          const next = Math.min(1, Math.max(0, event.translationY / RAIL_DRAG_DISTANCE))
          railProgress.set(next)
          if (next >= POST_MOTION.railThresholds.commit) {
            scheduleOnRN(hapticSelection)
          }
        })
        .onEnd(event => {
          const target = railReleaseTarget(railProgress.get(), event.velocityY)
          if (target === 'open') {
            railProgress.set(withSpring(1, postSpringConfig('rail')))
            scheduleOnRN(setMode, 'contextOpen')
            scheduleOnRN(hapticLight)
          } else {
            railProgress.set(withSpring(0, postSpringConfig('rail')))
            scheduleOnRN(setMode, 'idle')
          }
        }),
    [railProgress, setMode],
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
    const translateX = interpolate(p, [0, 1], [0, -(POST_GEOMETRY.contextMenuWidth - POST_GEOMETRY.actionRailWidth)])
    return {
      opacity: 1 - comments * 0.85,
      transform: [{translateX}, {scale: 1 - comments * 0.04}],
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

  const closeContext = () => {
    setMode('idle')
    railProgress.set(withSpring(0, postSpringConfig('rail')))
  }

  const openReaction = () => {
    if (reduceMotion) {
      onReact(currentReaction === 'like' ? null : 'like')
      return
    }
    setReactionOpen(true)
    setMode('reactionSelecting')
  }

  return (
    <>
      <GestureDetector gesture={railPan}>
        <Animated.View
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
                label={liked ? 'Unlike' : 'Like'}
                icon="like"
                selected={liked}
                count={post.likeCount}
                onPress={() => onReact(currentReaction === 'like' ? null : 'like')}
                onLongPress={openReaction}
              />
              <RailButton
                label="Comment"
                icon="comment"
                count={post.replyCount}
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
              <PostContextMenu actions={contextActions} onClose={closeContext} />
            </Animated.View>
          </PostSurface>
        </Animated.View>
      </GestureDetector>

      <ReactionPicker
        visible={reactionOpen}
        customOpen={customOpen}
        currentReaction={currentReaction}
        onClose={() => {
          setReactionOpen(false)
          setCustomOpen(false)
          setMode('idle')
        }}
        onOpenCustom={() => setCustomOpen(true)}
        onSelect={reaction => {
          onReact(reaction)
          setReactionOpen(false)
          setCustomOpen(false)
          setMode('idle')
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  compactColumn: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 10,
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
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  railAnchor: {
    bottom: 72,
    position: 'absolute',
    right: POST_GEOMETRY.railInset,
  },
  railButton: {
    alignItems: 'center',
    height: POST_GEOMETRY.actionButtonSize,
    justifyContent: 'center',
    width: POST_GEOMETRY.actionButtonSize,
  },
  railSurface: {
    minHeight: 220,
    overflow: 'hidden',
  },
  saveLabel: {
    color: 'rgba(255,255,255,0.86)',
    fontSize: 10,
    marginTop: 2,
  },
})
