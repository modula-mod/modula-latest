#!/usr/bin/env node
import assert from 'node:assert/strict'

const railThresholds = {commit: 0.85}

function railReleaseTarget(progress, velocityY) {
  if (velocityY > 900) return 'open'
  if (velocityY < -400 && progress < railThresholds.commit) return 'rest'
  return progress >= railThresholds.commit ? 'open' : 'rest'
}

const commentsSnapPoints = {closed: 0, peek: 0.25, partial: 0.55, full: 0.9}

function commentsSnapTarget(progress, velocityY) {
  const projected = progress - velocityY / 4200
  if (projected <= 0.12) return 'closed'
  if (velocityY < -900) {
    if (progress < commentsSnapPoints.peek) return 'peek'
    if (progress < commentsSnapPoints.partial) return 'partial'
    return 'full'
  }
  const candidates = ['closed', 'peek', 'partial', 'full']
  let nearest = 'closed'
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

function commentsModeForSnap(snap) {
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

function reactionIndexFromX(x, slotWidth, count) {
  if (slotWidth <= 0 || count <= 0) return 0
  return Math.min(count - 1, Math.max(0, Math.floor(x / slotWidth)))
}

assert.equal(railReleaseTarget(0.1, 0), 'rest')
assert.equal(railReleaseTarget(0.9, 0), 'open')
assert.equal(railReleaseTarget(0.4, 1200), 'open')
assert.equal(commentsSnapTarget(0.1, 0), 'closed')
assert.equal(commentsSnapTarget(0.24, 0), 'peek')
assert.equal(commentsSnapTarget(0.5, 0), 'partial')
assert.equal(commentsModeForSnap('partial'), 'commentsPartial')
assert.equal(reactionIndexFromX(120, 52, 6), 2)

console.log('post interaction machine tests passed')
