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
  emoji: string
  label: string
}

export const DEFAULT_REACTIONS: ReactionOption[] = [
  {type: 'like', emoji: '❤️', label: 'Like'},
  {type: 'laugh', emoji: '😂', label: 'Laugh'},
  {type: 'curious', emoji: '😮', label: 'Wow'},
  {type: 'support', emoji: '😢', label: 'Sad'},
  {type: 'fire', emoji: '😡', label: 'Angry'},
]

export const CUSTOM_REACTIONS: ReactionOption[] = [
  {type: 'celebrate', emoji: '👍', label: 'Thumbs up'},
  {type: 'insightful', emoji: '🙌', label: 'Hands up'},
  {type: 'fire', emoji: '🔥', label: 'Fire'},
  {type: 'celebrate', emoji: '🎉', label: 'Party'},
  {type: 'love', emoji: '💯', label: '100'},
  {type: 'love', emoji: '💜', label: 'Purple heart'},
  {type: 'insightful', emoji: '⭐', label: 'Star'},
  {type: 'curious', emoji: '🤔', label: 'Thinking'},
  {type: 'celebrate', emoji: '🚀', label: 'Rocket'},
  {type: 'curious', emoji: '👀', label: 'Eyes'},
]
