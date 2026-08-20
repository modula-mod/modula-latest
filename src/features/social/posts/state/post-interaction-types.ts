import type {AppIconName} from '@/components/primitives/AppIcon'

export type PostInteractionMode =
  | 'idle'
  | 'railDragging'
  | 'contextOpen'
  | 'reactionHolding'
  | 'reactionSelecting'
  | 'commentsDragging'
  | 'commentsPeek'
  | 'commentsPartial'
  | 'commentsFull'
  | 'mediaExpanded'

export type PostInteractionProgress = {
  railProgress: number
  commentsProgress: number
  reactionProgress: number
  mediaExpansionProgress: number
}

export type PostContextAction = {
  id: string
  label: string
  icon: string
  destructive?: boolean
  handler: () => void
}

export type ReactionOption = {
  type: string
  icon: AppIconName
  label: string
}

export const DEFAULT_REACTIONS: ReactionOption[] = [
  {type: 'like', icon: 'reactionLike', label: 'Like'},
  {type: 'love', icon: 'reactionLove', label: 'Love'},
  {type: 'laugh', icon: 'reactionLaugh', label: 'Laugh'},
  {type: 'fire', icon: 'reactionFire', label: 'Fire'},
  {type: 'support', icon: 'reactionSupport', label: 'Support'},
]

export const CUSTOM_REACTIONS: ReactionOption[] = [
  {type: 'celebrate', icon: 'reactionCelebrate', label: 'Celebrate'},
  {type: 'insightful', icon: 'reactionInsightful', label: 'Insightful'},
  {type: 'curious', icon: 'reactionCurious', label: 'Curious'},
]
