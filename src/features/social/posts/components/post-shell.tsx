import {useMemo} from 'react'
import {LayoutChangeEvent, StyleSheet, View} from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated'
import {Gesture, GestureDetector} from 'react-native-gesture-handler'
import {scheduleOnRN} from 'react-native-worklets'
import * as Haptics from 'expo-haptics'
import {useRouter, type Href} from 'expo-router'

import type {ReactionType, SocialPost} from '@/domain/social'
import {ProtectedActionPrompt} from '@/auth/components/ProtectedActionPrompt'
import {useCapability, useProtectedPrompt, useSession} from '@/auth/runtime'
import {buildPostOverflowActions, runPostOverflowAction} from '@/features/feed/postActions'
import {useSavePostMutation} from '@/features/feed/data'
import {useReactionMutation} from '@/features/social/data/useReactionMutation'
import {useCommentsQuery} from '@/features/social/data/useCommentsQuery'
import {PostActionRail} from '@/features/social/posts/components/post-action-rail'
import {PostBottomHandle} from '@/features/social/posts/components/post-bottom-handle'
import {PostCaption} from '@/features/social/posts/components/post-caption'
import {PostHeader} from '@/features/social/posts/components/post-header'
import {CommentsSurface} from '@/features/social/posts/interactions/comments-surface'
import {
  PostInteractionProvider,
  postSpringConfig,
  usePostInteraction,
} from '@/features/social/posts/interactions/post-interaction-context'
import {PostContentRenderer} from '@/features/social/posts/renderers/post-content-renderer'
import {
  commentsModeForSnap,
  commentsSnapTarget,
} from '@/features/social/posts/state/post-interaction-machine'
import type {PostContextAction} from '@/features/social/posts/state/post-interaction-types'
import {POST_GEOMETRY} from '@/features/social/posts/tokens/post-geometry'
import {POST_MOTION} from '@/features/social/posts/tokens/post-motion'
import {
  defaultPostAspectRatio,
  resolvePostContent,
} from '@/features/social/posts/types/resolve-post-content'
import {useReduceMotion} from '@/lib/accessibility'
import {lightImpactHaptic} from '@/lib/haptics'
import {useAppServices} from '@/runtime'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type PostShellProps = {
  post: SocialPost
  active?: boolean
  compact?: boolean
}

function PostShellInner({post, active = true, compact}: PostShellProps) {
  const router = useRouter()
  const session = useSession()
  const {moderationRepository} = useAppServices()
  const {colours, spacing} = useThemeTokens()
  const canEngage = useCapability('post:engage')
  const prompt = useProtectedPrompt()
  const reaction = useReactionMutation()
  const save = useSavePostMutation()
  const commentsQuery = useCommentsQuery(post.id)
  const content = useMemo(() => resolvePostContent(post), [post])
  const aspectRatio = defaultPostAspectRatio(content)

  const {commentsProgress, railProgress, shellHeight, setMode} = usePostInteraction()

  const isOwner = session.status === 'signedIn' && session.profile.id === post.author.id
  const contextActions: PostContextAction[] = buildPostOverflowActions(post, {isOwner}).map(
    action => ({
      id: action.id,
      label: action.label,
      icon: action.id,
      destructive: action.style === 'destructive',
      handler: () => {
        void runPostOverflowAction(action.id, post, {moderationRepository})
      },
    }),
  )

  const protectedRun = (action: () => void) => {
    if (!canEngage) {
      prompt.show()
      return
    }
    action()
  }

  const onReact = (next: ReactionType | null) => {
    void lightImpactHaptic()
    protectedRun(() => reaction.mutate({postId: post.id, reaction: next}))
  }

  const onDoubleTapLike = () => {
    protectedRun(() => onReact(post.viewerReaction === 'like' || post.liked ? null : 'like'))
  }

  const onLayout = (event: LayoutChangeEvent) => {
    shellHeight.set(event.nativeEvent.layout.height)
  }

  const mediaStyle = useAnimatedStyle(() => ({
    opacity: interpolate(commentsProgress.get(), [0, 0.55, 1], [1, 0.92, 0.85]),
    transform: [{scale: interpolate(commentsProgress.get(), [0, 1], [1, 0.985])}],
  }))

  const dimStyle = useAnimatedStyle(() => ({
    opacity: Math.max(railProgress.get() * 0.45, commentsProgress.get() * 0.35),
  }))

  const bottomPan = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY([-9999, -10])
        .failOffsetX([-24, 24])
        .onUpdate(event => {
          const next = Math.min(1, Math.max(0, -event.translationY / 280))
          commentsProgress.set(next)
        })
        .onEnd(event => {
          const snap = commentsSnapTarget(commentsProgress.get(), event.velocityY)
          commentsProgress.set(
            withSpring(POST_MOTION.commentsSnapPoints[snap], {
              ...postSpringConfig('comments'),
              velocity: event.velocityY,
            }),
          )
          scheduleOnRN(setMode, commentsModeForSnap(snap))
          if (snap !== 'closed') {
            scheduleOnRN(() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined)
            })
          }
        }),
    [commentsProgress, setMode],
  )

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.shell,
        {
          aspectRatio,
          backgroundColor: colours.surface1,
          borderRadius: compact ? POST_GEOMETRY.compactRadius : POST_GEOMETRY.outerRadius,
          marginBottom: spacing[2],
          marginHorizontal: spacing[3],
        },
      ]}>
      <Animated.View style={[StyleSheet.absoluteFill, mediaStyle]}>
        <PostContentRenderer
          content={content}
          active={active}
          onDoubleTapLike={onDoubleTapLike}
        />
      </Animated.View>

      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, dimStyle, {backgroundColor: colours.backdrop}]} />
      <PostHeader post={post} />
      <PostCaption text={post.text} opacity={commentsProgress} />
      <PostActionRail
        post={post}
        contextActions={contextActions}
        onReact={onReact}
        onSave={() => protectedRun(() => save.mutate({postId: post.id, saved: !post.saved}))}
        onShare={() => void runPostOverflowAction('share', post, {moderationRepository})}
        onCommentPress={() => router.push(`/post/${post.id}` as Href)}
      />
      <GestureDetector gesture={bottomPan}>
        <View style={styles.bottomZone}>
          <PostBottomHandle progress={commentsProgress} />
        </View>
      </GestureDetector>
      <CommentsSurface
        postId={post.id}
        commentCount={post.replyCount}
        comments={commentsQuery.data}
        isLoading={commentsQuery.isLoading}
        isError={commentsQuery.isError}
      />
      <ProtectedActionPrompt
        visible={prompt.visible}
        onClose={prompt.hide}
        description="Sign in to react, save, or comment in this local Modula build."
      />
    </View>
  )
}

export function PostShell(props: PostShellProps) {
  const reduceMotion = useReduceMotion()
  return (
    <PostInteractionProvider reduceMotion={reduceMotion}>
      <PostShellInner {...props} />
    </PostInteractionProvider>
  )
}

const styles = StyleSheet.create({
  bottomZone: {
    bottom: 0,
    height: POST_GEOMETRY.bottomActivationHeight,
    left: 0,
    position: 'absolute',
    right: 0,
  },
  shell: {
    overflow: 'hidden',
    position: 'relative',
    width: '100%',
  },
})
