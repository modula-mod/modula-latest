import type {ModulaProfileDto, ProfileLink, ProfileVisibility} from '@modula/api-contracts'
import type {Database} from '../../database/types.js'

type ProfileRow = Database['profiles']
type LinkRow = Database['profile_links']

function mapLink(row: LinkRow): ProfileLink {
  return {
    id: row.id,
    label: row.label,
    url: row.url,
    domain: row.domain,
    visibility: row.visibility as ProfileVisibility,
  }
}

export function mapProfile(
  row: ProfileRow,
  links: LinkRow[],
  counts: {followers: number; following: number; posts: number},
): ModulaProfileDto {
  const website =
    row.website_url && row.website_label && row.website_domain && row.website_visibility
      ? {
          id: `link-website-${row.id}`,
          label: row.website_label,
          url: row.website_url,
          domain: row.website_domain,
          visibility: row.website_visibility as ProfileVisibility,
        }
      : undefined

  return {
    id: row.id,
    handle: row.handle,
    displayName: row.display_name,
    kind: row.kind,
    avatarUri: row.avatar_url ?? undefined,
    coverUri: row.cover_url ?? undefined,
    coverColour: row.cover_colour ?? undefined,
    bio: row.bio,
    pronouns: row.pronouns ?? undefined,
    location:
      row.location_label && row.location_visibility
        ? {label: row.location_label, visibility: row.location_visibility as ProfileVisibility}
        : undefined,
    website,
    followerCount: counts.followers,
    followingCount: counts.following,
    moduleCount: row.module_count,
    postCount: counts.posts,
    joinedAt: row.joined_at.toISOString(),
    focusStatus: {
      id: row.focus_status_id,
      label: row.focus_status_label,
      message: row.focus_status_message,
      updatedAt: row.focus_status_updated_at.toISOString(),
    },
    identityClaims: Array.isArray(row.identity_claims)
      ? (row.identity_claims as Array<Record<string, unknown>>)
      : [],
    links: links.map(mapLink),
    featuredModuleIds: Array.isArray(row.featured_module_ids) ? row.featured_module_ids : [],
    isFollowing: false,
    followsViewer: false,
    version: row.version,
  }
}
