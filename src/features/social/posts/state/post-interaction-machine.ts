import type {PostInteractionMode} from '@/features/social/posts/state/post-interaction-types'

export {
  commentsModeForSnap,
  commentsSnapTarget,
  postSpringConfig,
  railReleaseTarget,
  reactionIndexFromX,
} from '@/features/social/posts/interactions/post-ui-worklets'

export function canOpenComments(mode: PostInteractionMode): boolean {
  return mode !== 'contextOpen' && mode !== 'reactionHolding' && mode !== 'reactionSelecting' && mode !== 'mediaExpanded'
}

export function canOpenContext(mode: PostInteractionMode): boolean {
  return mode === 'idle' || mode === 'railDragging'
}

export function canStartReaction(mode: PostInteractionMode): boolean {
  return mode === 'idle'
}
