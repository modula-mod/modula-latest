import type {AtprotoConnectionDto, AtprotoPublicationPreference} from '@modula/api-contracts'

import type {DraftPoll, PendingMediaAttachment, PostAudience} from '@/domain/social'
import {DEFAULT_PUBLISHING_DESTINATION} from '@/features/atproto/copy'

export type PublishingDestination = 'modula' | 'modula+atproto'

export type CrossPostEligibilityInput = {
  atprotoPublishingCapability: boolean
  connection: AtprotoConnectionDto | null | undefined
  preferences: AtprotoPublicationPreference | null | undefined
  audience: PostAudience
  media: PendingMediaAttachment[]
  poll?: DraftPoll | null
  isDraft?: boolean
  textLength: number
  /** Sensitive / internal content flags — never cross-post. */
  sensitiveInternal?: boolean
}

export type CrossPostBlockReason =
  | 'capability'
  | 'notConnected'
  | 'unhealthy'
  | 'noPublishScope'
  | 'privateAudience'
  | 'followersAudience'
  | 'teamAudience'
  | 'draft'
  | 'unsupportedMedia'
  | 'unsupportedPoll'
  | 'sensitiveInternal'
  | 'atLimit'
  | 'preferenceDisabled'

const AT_TEXT_LIMIT = 300

export function connectionHasPublishPermission(connection: AtprotoConnectionDto): boolean {
  return connection.grantedScopes.some(
    scope =>
      scope.includes('repo:') ||
      scope.includes('transition:generic') ||
      scope === 'publish',
  )
}

export function isHealthyAtprotoConnection(connection: AtprotoConnectionDto): boolean {
  return connection.status === 'connected'
}

export function evaluateCrossPostEligibility(input: CrossPostEligibilityInput): {
  allowed: boolean
  reason?: CrossPostBlockReason
} {
  if (!input.atprotoPublishingCapability) {
    return {allowed: false, reason: 'capability'}
  }
  if (!input.connection) {
    return {allowed: false, reason: 'notConnected'}
  }
  if (!isHealthyAtprotoConnection(input.connection)) {
    return {allowed: false, reason: 'unhealthy'}
  }
  if (!connectionHasPublishPermission(input.connection)) {
    return {allowed: false, reason: 'noPublishScope'}
  }
  if (input.audience === 'followers') {
    return {allowed: false, reason: 'followersAudience'}
  }
  if (input.audience === 'innerCircle') {
    return {allowed: false, reason: 'privateAudience'}
  }
  if (input.audience === 'modules') {
    return {allowed: false, reason: 'teamAudience'}
  }
  if (input.audience !== 'public') {
    return {allowed: false, reason: 'privateAudience'}
  }
  if (input.isDraft) {
    return {allowed: false, reason: 'draft'}
  }
  if (input.media.length > 0) {
    // Phase 6: media upload to AT is not enabled (mediaUpload capability false).
    return {allowed: false, reason: 'unsupportedMedia'}
  }
  if (input.poll) {
    return {allowed: false, reason: 'unsupportedPoll'}
  }
  if (input.sensitiveInternal) {
    return {allowed: false, reason: 'sensitiveInternal'}
  }
  if (input.textLength > AT_TEXT_LIMIT) {
    return {allowed: false, reason: 'atLimit'}
  }
  if (input.preferences && !input.preferences.enabled && input.preferences.defaultMode === 'modulaOnly') {
    // Preference UI still allows per-post ask/cross-post when user explicitly enables publishing.
  }
  return {allowed: true}
}

export function resolveDefaultDestination(
  preferences: AtprotoPublicationPreference | null | undefined,
  eligibilityAllowed: boolean,
): PublishingDestination {
  if (!eligibilityAllowed) return DEFAULT_PUBLISHING_DESTINATION
  if (!preferences) return DEFAULT_PUBLISHING_DESTINATION
  if (preferences.defaultMode === 'crossPostPublic' && preferences.enabled) {
    return 'modula+atproto'
  }
  return DEFAULT_PUBLISHING_DESTINATION
}

export function destinationToPublishFlag(destination: PublishingDestination): boolean {
  return destination === 'modula+atproto'
}
