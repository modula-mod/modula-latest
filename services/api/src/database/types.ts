export type ActorKind = 'person' | 'team' | 'organisation' | 'service'
export type ProfileKind = 'person' | 'creator' | 'professional' | 'organisation' | 'team'
export type ProfileVisibility = 'public' | 'followers' | 'teams' | 'private'
export type PostKind = 'text' | 'media' | 'link' | 'module'
export type FeedMode = 'following' | 'forYou' | 'modules'
export type Audience = 'public' | 'followers' | 'private'
export type ReplyPermission = 'everyone' | 'followers' | 'mentioned' | 'none'

export interface Database {
  schema_metadata: {
    key: string
    value: string
    updated_at: Date
  }
  actors: {
    id: string
    kind: ActorKind
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  profiles: {
    id: string
    actor_id: string
    handle: string
    display_name: string
    kind: ProfileKind
    bio: string
    avatar_url: string | null
    cover_url: string | null
    cover_colour: string | null
    pronouns: string | null
    location_label: string | null
    location_visibility: ProfileVisibility | null
    website_label: string | null
    website_url: string | null
    website_domain: string | null
    website_visibility: ProfileVisibility | null
    focus_status_id: string
    focus_status_label: string
    focus_status_message: string
    focus_status_updated_at: Date
    visibility: ProfileVisibility
    module_count: number
    featured_module_ids: string[]
    identity_claims: unknown
    joined_at: Date
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  profile_links: {
    id: string
    profile_id: string
    label: string
    url: string
    domain: string
    visibility: ProfileVisibility
    sort_order: number
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  posts: {
    id: string
    author_actor_id: string
    kind: PostKind
    text: string | null
    feed: FeedMode
    audience: Audience
    reply_permission: ReplyPermission
    idempotency_key: string | null
    link_domain: string | null
    link_title: string | null
    link_description: string | null
    link_image: string | null
    module_name: string | null
    module_action_label: string | null
    module_status: string | null
    glow_colour: string | null
    like_count: number
    reply_count: number
    repost_count: number
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  post_media: {
    id: string
    post_id: string
    kind: 'image'
    url: string | null
    title: string | null
    colour: string | null
    aspect_ratio: string | null
    alt_text: string | null
    sort_order: number
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  follows: {
    id: string
    follower_actor_id: string
    followed_actor_id: string
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  post_likes: {
    id: string
    actor_id: string
    post_id: string
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  post_saves: {
    id: string
    actor_id: string
    post_id: string
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  post_reposts: {
    id: string
    actor_id: string
    post_id: string
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  idempotency_keys: {
    id: string
    actor_id: string
    key: string
    request_hash: string
    response_status: number | null
    response_body: unknown | null
    created_at: Date
    updated_at: Date
    expires_at: Date
  }
  audit_events: {
    id: string
    event_type: string
    actor_id: string | null
    resource_type: string | null
    resource_id: string | null
    metadata: unknown
    created_at: Date
  }
  outbox_events: {
    id: string
    event_type: string
    aggregate_type: string
    aggregate_id: string
    payload: unknown
    created_at: Date
    published_at: Date | null
    attempt_count: number
    last_error: string | null
  }
  activity_items: {
    id: string
    group_key: string
    type: string
    actor_id: string | null
    icon: string | null
    description: string
    preview: string | null
    action_label: string | null
    occurred_at: Date
    created_at: Date
    deleted_at: Date | null
  }
  reels: {
    id: string
    author_actor_id: string
    caption: string
    source: string
    colour: string
    like_count: number
    reply_count: number
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  trending_topics: {
    id: string
    label: string
    post_count: number
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
  }
  featured_modules: {
    id: string
    payload: unknown
    sort_order: number
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
  }
}
