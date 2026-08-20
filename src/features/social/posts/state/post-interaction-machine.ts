import {POST_MOTION} from '@/features/social/posts/tokens/post-motion'
import type {PostInteractionMode} from '@/features/social/posts/state/post-interaction-types'

const {railThresholds, commentsSnapPoints} = POST_MOTION

export function railReleaseTarget(
  progress: number,
  velocityY: number,
): 'rest' | 'open' {
  if (velocityY > 900) return 'open'
  if (velocityY < -400 && progress < railThresholds.commit) return 'rest'
  return progress >= railThresholds.commit ? 'open' : 'rest'
}

export function commentsSnapTarget(
  progress: number,
  velocityY: number,
): keyof typeof commentsSnapPoints {
  const projected = progress - velocityY / 4200
  if (projected <= 0.12) return 'closed'
  if (velocityY < -900) {
    if (progress < commentsSnapPoints.peek) return 'peek'
    if (progress < commentsSnapPoints.partial) return 'partial'
    return 'full'
  }
  const candidates: (keyof typeof commentsSnapPoints)[] = [
    'closed',
    'peek',
    'partial',
    'full',
  ]
  let nearest: keyof typeof commentsSnapPoints = 'closed'
  let best = Number.POSITIVE_INFINITY
  for (const key of candidates) {
    const delta = Math.abs(projected - commentsSnapPoints[key])
    if (delta < best) {
      best = delta
      nearest = key
    }
  }
  return nearest
}

export function commentsModeForSnap(
  snap: keyof typeof commentsSnapPoints,
): PostInteractionMode {
  switch (snap) {
    case 'closed':
      return 'idle'
    case 'peek':
      return 'commentsPeek'
    case 'partial':
      return 'commentsPartial'
    case 'full':
      return 'commentsFull'
    default:
      return 'idle'
  }
}

export function canOpenComments(mode: PostInteractionMode): boolean {
  return mode !== 'contextOpen' && mode !== 'reactionHolding' && mode !== 'reactionSelecting' && mode !== 'mediaExpanded'
}

export function canOpenContext(mode: PostInteractionMode): boolean {
  return mode === 'idle' || mode === 'railDragging'
}

export function canStartReaction(mode: PostInteractionMode): boolean {
  return mode === 'idle'
}

export function reactionIndexFromX(
  x: number,
  slotWidth: number,
  count: number,
): number {
  if (slotWidth <= 0 || count <= 0) return 0
  return Math.min(count - 1, Math.max(0, Math.floor(x / slotWidth)))
}
