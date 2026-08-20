export const POST_GEOMETRY = {
  outerRadius: 32,
  compactRadius: 24,
  actionRailWidth: 58,
  actionRailRadius: 29,
  actionButtonSize: 44,
  contextMenuWidth: 270,
  contextMenuRadius: 28,
  reactionHeight: 58,
  reactionRadius: 29,
  bottomHandleWidth: 44,
  bottomHandleHeight: 5,
  commentsRadius: 30,
  railGrabWidth: 12,
  captionScrimHeight: 120,
  headerInset: 12,
  railInset: 10,
  bottomActivationHeight: 48,
} as const

export type PostGeometry = typeof POST_GEOMETRY
