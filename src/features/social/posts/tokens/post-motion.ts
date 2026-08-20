export const POST_MOTION = {
  pressMs: 100,
  reactionRevealMs: 200,
  railSnap: {
    damping: 22,
    stiffness: 240,
  },
  commentsSnap: {
    damping: 24,
    stiffness: 220,
  },
  playerSnap: {
    damping: 22,
    stiffness: 200,
  },
  railThresholds: {
    follow: 0.2,
    compress: 0.45,
    widen: 0.7,
    labels: 0.85,
    commit: 0.85,
  },
  commentsSnapPoints: {
    closed: 0,
    peek: 0.25,
    partial: 0.55,
    full: 0.9,
  },
  reactionHoldMs: 320,
} as const

export type PostMotion = typeof POST_MOTION
