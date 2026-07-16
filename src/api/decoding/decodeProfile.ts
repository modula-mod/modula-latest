import type {
  FocusStatus,
  ModulaProfile,
  ProfileKind,
  ProfileLink,
  ProfileLocation,
  ProfileVisibility,
} from '@/features/profile/contracts'
import {asArray, asBoolean, asIsoDate, asNumber, asRecord, asString, optional} from '@/api/decoding/validation'

const profileKinds = new Set<ProfileKind>(['person', 'creator', 'professional', 'organisation', 'team'])
const visibilityValues = new Set<ProfileVisibility>(['public', 'followers', 'teams', 'private'])

function decodeVisibility(value: unknown): ProfileVisibility {
  const next = asString(value, 'visibility')
  if (!visibilityValues.has(next as ProfileVisibility)) {
    throw new Error('Invalid profile visibility.')
  }
  return next as ProfileVisibility
}

function decodeFocusStatus(value: unknown): FocusStatus {
  const record = asRecord(value, 'focus status')
  return {
    id: asString(record.id, 'focus status id') as FocusStatus['id'],
    label: asString(record.label, 'focus status label'),
    message: asString(record.message, 'focus status message'),
    updatedAt: asIsoDate(record.updatedAt, 'focus status updatedAt'),
  }
}

function decodeLink(value: unknown): ProfileLink {
  const record = asRecord(value, 'profile link')
  return {
    id: asString(record.id, 'profile link id'),
    label: asString(record.label, 'profile link label'),
    url: asString(record.url, 'profile link url'),
    domain: asString(record.domain, 'profile link domain'),
    visibility: decodeVisibility(record.visibility),
  }
}

function decodeLocation(value: unknown): ProfileLocation {
  const record = asRecord(value, 'profile location')
  return {
    label: asString(record.label, 'profile location label'),
    visibility: decodeVisibility(record.visibility),
  }
}

export function decodeProfile(value: unknown): ModulaProfile {
  const record = asRecord(value, 'profile')
  const kind = asString(record.kind, 'profile kind')
  if (!profileKinds.has(kind as ProfileKind)) {
    throw new Error('Invalid profile kind.')
  }
  return {
    id: asString(record.id, 'profile id'),
    handle: asString(record.handle, 'profile handle'),
    displayName: asString(record.displayName, 'profile display name'),
    kind: kind as ProfileKind,
    avatarUri: optional(record.avatarUri, item => asString(item, 'avatar uri')),
    coverUri: optional(record.coverUri, item => asString(item, 'cover uri')),
    coverColour: optional(record.coverColour, item => asString(item, 'cover colour')),
    bio: asString(record.bio, 'profile bio'),
    pronouns: optional(record.pronouns, item => asString(item, 'profile pronouns')),
    location: optional(record.location, decodeLocation),
    website: optional(record.website, decodeLink),
    followerCount: asNumber(record.followerCount, 'follower count'),
    followingCount: asNumber(record.followingCount, 'following count'),
    moduleCount: asNumber(record.moduleCount, 'module count'),
    postCount: asNumber(record.postCount, 'post count'),
    joinedAt: asIsoDate(record.joinedAt, 'joined at'),
    focusStatus: decodeFocusStatus(record.focusStatus),
    identityClaims: asArray(record.identityClaims, 'identity claims', item => asRecord(item, 'identity claim') as ModulaProfile['identityClaims'][number]),
    links: asArray(record.links, 'profile links', decodeLink),
    featuredModuleIds: asArray(record.featuredModuleIds, 'featured modules', item => asString(item, 'module id')),
    isFollowing: asBoolean(record.isFollowing, 'is following'),
    followsViewer: asBoolean(record.followsViewer, 'follows viewer'),
  }
}
