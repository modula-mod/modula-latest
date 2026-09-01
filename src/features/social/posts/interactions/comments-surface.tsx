import {useCallback, useEffect, useMemo, useState} from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import {GestureDetector} from 'react-native-gesture-handler'
import Animated, {Extrapolation, interpolate, useAnimatedStyle, useSharedValue, withSpring, withTiming} from 'react-native-reanimated'

import type {PostId} from '@/api/contracts'
import {useSession} from '@/auth/runtime'
import {AppIcon} from '@/components/primitives/AppIcon'
import {AppPressable} from '@/components/primitives/AppPressable'
import {AppText} from '@/components/primitives/AppText'
import {Avatar} from '@/components/primitives/Avatar'
import type {SocialComment} from '@/domain/social'
import {CommentPreview} from '@/features/social/components/comment-preview'
import {useCommentMutations} from '@/features/social/data/useCommentsQuery'
import {PostSurface} from '@/features/social/posts/components/post-surface'
import {postSpringConfig, usePostInteraction} from '@/features/social/posts/interactions/post-interaction-context'
import {createCommentsSheetPan} from '@/features/social/posts/interactions/post-ui-worklets'
import {commentsModeForSnap} from '@/features/social/posts/state/post-interaction-machine'
import {POST_GEOMETRY} from '@/features/social/posts/tokens/post-geometry'
import {postLayerZ} from '@/features/social/posts/tokens/post-layout'
import {POST_MOTION} from '@/features/social/posts/tokens/post-motion'
import {useThemeTokens} from '@/theme/runtime/useThemeTokens'

type CommentsSurfaceProps = {
  postId: PostId
  commentCount: number
  comments: SocialComment[] | undefined
  isLoading: boolean
  isError: boolean
  isOffline?: boolean
  disabled?: boolean
  onRetry: () => void
  onRequireAuth: () => void
}

export function CommentsSurface({
  postId,
  commentCount,
  comments,
  isLoading,
  isError,
  isOffline,
  disabled,
  onRetry,
  onRequireAuth,
}: CommentsSurfaceProps) {
  const session = useSession()
  const mutations = useCommentMutations(postId)
  const {height: viewportHeight} = useWindowDimensions()
  const {colours, spacing} = useThemeTokens()
  const {commentsProgress, mode, reduceMotion, setMode} = usePostInteraction()
  const [text, setText] = useState('')
  const dragStart = useSharedValue<number>(POST_MOTION.commentsSnapPoints.partial)
  const signedIn = session.status === 'signedIn'
  const visible = mode === 'commentsDragging' || mode === 'commentsPeek' || mode === 'commentsPartial' || mode === 'commentsFull'

  const animateTo = useCallback((snap: keyof typeof POST_MOTION.commentsSnapPoints, velocity = 0) => {
    const value = POST_MOTION.commentsSnapPoints[snap]
    commentsProgress.set(
      reduceMotion
        ? withTiming(value, {duration: 120})
        : withSpring(value, {...postSpringConfig('comments'), velocity}),
    )
    setMode(commentsModeForSnap(snap))
  }, [commentsProgress, reduceMotion, setMode])

  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return undefined

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      animateTo('closed')
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [animateTo, visible])

  const sheetPan = useMemo(
    () =>
      createCommentsSheetPan({
        commentsProgress,
        dragStart,
        reduceMotion,
        setMode,
      }),
    [commentsProgress, dragStart, reduceMotion, setMode],
  )

  const sheetStyle = useAnimatedStyle(() => {
    const progress = commentsProgress.get()
    const peekHeight = Math.min(220, viewportHeight * 0.3)
    const partialHeight = viewportHeight * 0.56
    const fullHeight = viewportHeight * 0.94
    return {
      height: interpolate(
        progress,
        [POST_MOTION.commentsSnapPoints.peek, POST_MOTION.commentsSnapPoints.partial, POST_MOTION.commentsSnapPoints.full],
        [peekHeight, partialHeight, fullHeight],
        Extrapolation.CLAMP,
      ),
    }
  }, [viewportHeight])

  const chromeOpacity = useAnimatedStyle(() => ({
    opacity: interpolate(commentsProgress.get(), [0, 0.12, 0.4], [0, 0.7, 1]),
  }))

  const submit = () => {
    const value = text.trim()
    if (!signedIn) {
      onRequireAuth()
      return
    }
    if (!value || mutations.create.isPending) return
    mutations.create.mutate(value, {onSuccess: () => setText('')})
  }

  const authorLabel = (comment: SocialComment) =>
    signedIn && comment.authorId === session.profile.id ? 'You' : 'Member'

  let body = (
    <View style={[styles.message, {gap: spacing[1]}]}>
      <AppText variant="label">No comments yet</AppText>
      <AppText variant="body" colour="textSecondary">Start the conversation.</AppText>
    </View>
  )
  if (disabled) {
    body = <AppText variant="body" colour="textSecondary">Comments are disabled on this post.</AppText>
  } else if (isOffline) {
    body = <AppText variant="body" colour="textSecondary">You appear to be offline.</AppText>
  } else if (isError) {
    body = (
      <View style={[styles.message, {gap: spacing[2]}]}>
        <AppText variant="label">Comments couldn&apos;t load.</AppText>
        <AppPressable accessibilityLabel="Try loading comments again" onPress={onRetry} style={styles.retry}>
          <AppText variant="label" colour="accent">Try again</AppText>
        </AppPressable>
      </View>
    )
  } else if (isLoading) {
    body = <ActivityIndicator accessibilityLabel="Loading comments" color={colours.accent} />
  } else if (comments?.length) {
    body = (
      <View style={{gap: spacing[1]}}>
        {comments.map(comment => (
          <CommentPreview key={comment.id} comment={comment} authorLabel={authorLabel(comment)} />
        ))}
      </View>
    )
  }

  if (!visible) return null

  return (
    <Modal animationType="none" onRequestClose={() => animateTo('closed')} transparent visible>
      <View
        accessibilityViewIsModal
        onAccessibilityEscape={() => animateTo('closed')}
        style={[styles.root, {zIndex: postLayerZ('transient')}]}
        testID="post-comments-sheet">
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, chromeOpacity, {backgroundColor: colours.backdrop, opacity: 0.35}]} />
        <AppPressable
          accessibilityLabel="Dismiss comments"
          onPress={() => animateTo('closed')}
          style={StyleSheet.absoluteFill}
        />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}>
        <Animated.View style={[styles.sheet, chromeOpacity, sheetStyle]}>
          <PostSurface
            role="comments"
            style={[
              styles.panel,
              {
                borderTopLeftRadius: POST_GEOMETRY.commentsRadius,
                borderTopRightRadius: POST_GEOMETRY.commentsRadius,
              },
            ]}>
            <GestureDetector gesture={sheetPan}>
              <View accessibilityLabel="Drag comments" style={[styles.handleZone, {paddingTop: spacing[2]}]}>
                <View style={[styles.handle, {backgroundColor: colours.textMuted}]} />
              </View>
            </GestureDetector>
            <View style={[styles.header, {paddingHorizontal: spacing[4], paddingBottom: spacing[2]}]}>
              <View>
                <AppText variant="headline">Comments</AppText>
                <AppText variant="caption" colour="textSecondary">
                  {commentCount > 0 ? `${commentCount} in this conversation` : 'Be the first to respond'}
                </AppText>
              </View>
              <AppPressable accessibilityLabel="Close comments" onPress={() => animateTo('closed')} style={styles.close}>
                <AppIcon name="close" colour={colours.textMain} size={20} />
              </AppPressable>
            </View>
            <ScrollView
              contentContainerStyle={{paddingHorizontal: spacing[4], paddingBottom: spacing[3]}}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              style={styles.thread}>
              {body}
            </ScrollView>
            <View style={[styles.composer, {borderTopColor: colours.separator, gap: spacing[2], padding: spacing[3]}]}>
              <Avatar
                name={signedIn ? session.profile.displayName : 'You'}
                uri={signedIn ? session.profile.avatarUri : undefined}
                size={34}
              />
              <View style={[styles.inputWrap, {backgroundColor: colours.surface2, borderColor: colours.borderStrong}]}>
                <TextInput
                  accessibilityLabel="Write a comment"
                  editable={signedIn && !mutations.create.isPending}
                  multiline
                  onChangeText={setText}
                  onFocus={() => animateTo('full')}
                  onPressIn={() => {
                    if (!signedIn) onRequireAuth()
                  }}
                  placeholder={signedIn ? 'Write a comment…' : 'Sign in to comment'}
                  placeholderTextColor={colours.textMuted}
                  style={[styles.input, {color: colours.textMain}]}
                  value={text}
                />
                <AppPressable
                  accessibilityLabel="Send comment"
                  disabled={signedIn && (!text.trim() || mutations.create.isPending)}
                  onPress={submit}
                  style={styles.send}>
                  <AppIcon
                    name="send"
                    colour={text.trim() ? colours.accent : colours.textMuted}
                    size={19}
                  />
                </AppPressable>
              </View>
            </View>
          </PostSurface>
        </Animated.View>
      </KeyboardAvoidingView>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  close: {alignItems: 'center', height: 44, justifyContent: 'center', width: 44},
  composer: {alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row'},
  handle: {borderRadius: 999, height: 5, opacity: 0.75, width: 42},
  handleZone: {alignItems: 'center', height: 32, justifyContent: 'flex-start'},
  header: {alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between'},
  input: {flex: 1, maxHeight: 96, minHeight: 42, paddingHorizontal: 12, paddingVertical: 10},
  inputWrap: {alignItems: 'center', borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, flex: 1, flexDirection: 'row'},
  keyboard: {height: '100%', justifyContent: 'flex-end', width: '100%'},
  message: {alignItems: 'center', paddingVertical: 28},
  panel: {flex: 1, overflow: 'hidden'},
  retry: {minHeight: 44, paddingHorizontal: 18, justifyContent: 'center'},
  root: {flex: 1, justifyContent: 'flex-end'},
  send: {alignItems: 'center', height: 44, justifyContent: 'center', width: 44},
  sheet: {bottom: 0, position: 'absolute', width: '100%'},
  thread: {flex: 1},
})
