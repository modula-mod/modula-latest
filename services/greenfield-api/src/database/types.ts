export type ActorKind = 'person' | 'team' | 'organisation' | 'service'
export type ProfileKind = 'person' | 'creator' | 'professional' | 'organisation' | 'team'
export type ProfileVisibility = 'public' | 'followers' | 'teams' | 'private'
export type PostKind = 'text' | 'media' | 'link' | 'module'
export type FeedMode = 'following' | 'forYou' | 'modules'
export type Audience = 'public' | 'followers' | 'private'
export type ReplyPermission = 'everyone' | 'followers' | 'mentioned' | 'none'

export type SessionStatus = 'active' | 'expired' | 'revoked' | 'suspended'
export type NotificationType = 'follow' | 'like' | 'repost' | 'reply' | 'mention' | 'module_event'
export type ReportTargetType = 'profile' | 'post' | 'message' | 'other'
export type ReportCategory = 'spam' | 'harassment' | 'impersonation' | 'illegal-content' | 'privacy' | 'other'
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'
export type BackgroundJobStatus = 'pending' | 'leased' | 'completed' | 'failed' | 'dead_letter'
export type AtprotoConnectionStatus =
  | 'pending'
  | 'connected'
  | 'refreshRequired'
  | 'revoked'
  | 'disconnected'
  | 'error'
export type AtprotoClientKind = 'web' | 'native'
export type AtprotoPublicationMode = 'modulaOnly' | 'askEveryTime' | 'crossPostPublic'
export type AtprotoPublicationStatus =
  | 'pending'
  | 'publishing'
  | 'published'
  | 'updating'
  | 'deleting'
  | 'deleted'
  | 'failed'
  | 'revoked'

export interface Database {
  schema_metadata: {
    key: string
    value: string
    updated_at: Date
  }
  actors: {
    id: string
    account_id: string | null
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
    reaction_count: number
    quote_count: number
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

  // --- Phase 6 ---

  sessions: {
    id: string
    actor_id: string
    status: SessionStatus
    token_hash: string
    created_at: Date
    expires_at: Date
    last_seen_at: Date
    revoked_at: Date | null
    updated_at: Date
    version: number
  }
  session_capabilities: {
    id: string
    session_id: string
    capability: string
    granted_at: Date
    revoked_at: Date | null
    created_at: Date
    updated_at: Date
  }
  notifications: {
    id: string
    recipient_actor_id: string
    actor_id: string | null
    type: NotificationType
    resource_type: string | null
    resource_id: string | null
    body: string
    read_at: Date | null
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  notification_preferences: {
    id: string
    actor_id: string
    follow_enabled: boolean
    like_enabled: boolean
    repost_enabled: boolean
    reply_enabled: boolean
    mention_enabled: boolean
    module_event_enabled: boolean
    created_at: Date
    updated_at: Date
    version: number
  }
  blocks: {
    id: string
    blocker_actor_id: string
    blocked_actor_id: string
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  mutes: {
    id: string
    muter_actor_id: string
    muted_actor_id: string
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  reports: {
    id: string
    reporter_actor_id: string
    target_type: ReportTargetType
    target_id: string
    category: ReportCategory
    details: string
    status: ReportStatus
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  moderation_actions: {
    id: string
    report_id: string | null
    actor_id: string | null
    action_type: string
    metadata: unknown
    created_at: Date
    updated_at: Date
  }
  background_jobs: {
    id: string
    job_type: string
    payload: unknown
    status: BackgroundJobStatus
    priority: number
    available_at: Date
    lease_owner: string | null
    lease_expires_at: Date | null
    attempt_count: number
    maximum_attempts: number
    last_error: string | null
    created_at: Date
    updated_at: Date
    completed_at: Date | null
  }
  job_failures: {
    id: string
    job_id: string
    job_type: string
    payload: unknown
    error_code: string
    error_message: string
    permanent: boolean
    created_at: Date
  }
  atproto_connections: {
    id: string
    actor_id: string
    did: string
    handle: string
    pds_url: string
    status: AtprotoConnectionStatus
    granted_scopes: string[]
    connected_at: Date | null
    refreshed_at: Date | null
    disconnected_at: Date | null
    last_error_code: string | null
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
    version: number
  }
  atproto_oauth_states: {
    id: string
    state: string
    actor_id: string
    session_id: string
    client_kind: AtprotoClientKind
    return_route: string
    request_scope: string
    created_at: Date
    expires_at: Date
    consumed_at: Date | null
    updated_at: Date
  }
  atproto_oauth_sessions: {
    id: string
    connection_id: string
    encrypted_session: Buffer
    encryption_key_version: number
    created_at: Date
    updated_at: Date
    revoked_at: Date | null
  }
  atproto_publication_preferences: {
    id: string
    actor_id: string
    enabled: boolean
    default_mode: AtprotoPublicationMode
    publish_profile_extension: boolean
    publish_module_metadata: boolean
    created_at: Date
    updated_at: Date
    version: number
  }
  atproto_publications: {
    id: string
    connection_id: string
    local_record_type: string
    local_record_id: string
    collection: string
    rkey: string | null
    at_uri: string | null
    cid: string | null
    status: AtprotoPublicationStatus
    attempt_count: number
    published_at: Date | null
    deleted_at: Date | null
    last_error_code: string | null
    next_retry_at: Date | null
    created_at: Date
    updated_at: Date
    version: number
  }
  atproto_records: {
    did: string
    collection: string
    rkey: string
    uri: string
    cid: string
    record_json: unknown
    indexed_at: Date
    deleted_at: Date | null
    source_cursor: string | null
    created_at: Date
    updated_at: Date
  }
  atproto_sync_checkpoints: {
    source: string
    cursor: string
    updated_at: Date
    last_success_at: Date | null
  }
  atproto_dead_letters: {
    id: string
    source: string
    payload: unknown
    error_code: string
    error_message: string
    created_at: Date
    resolved_at: Date | null
  }
  operational_controls: {
    key: string
    value: unknown
    updated_at: Date
    updated_by: string | null
  }
  greenfield_accounts: {account_id: string; primary_handle: string; status: 'pendingVerification' | 'active' | 'suspended' | 'deactivated' | 'deleted'; created_at: Date; updated_at: Date}
  greenfield_handles: {handle: string; account_id: string; status: 'active' | 'released' | 'reserved'; created_at: Date}
  greenfield_handle_history: {history_id: string; account_id: string; handle: string; action: string; created_at: Date}
  greenfield_reserved_handles: {handle: string; reason: string; created_at: Date}
  greenfield_auth_identities: {identity_id: string; account_id: string; kind: 'email' | 'passkey' | 'oidc'; identifier: string; verified_at: Date | null; metadata: unknown; created_at: Date; updated_at: Date}
  greenfield_password_credentials: {account_id: string; password_hash: string; params: unknown; updated_at: Date}
  greenfield_passkeys: {passkey_id: string; account_id: string; credential_id: string; public_key: Buffer; counter: number; transports: unknown; created_at: Date; last_used_at: Date | null}
  greenfield_email_verifications: {verification_id: string; account_id: string; token_hash: string; expires_at: Date; consumed_at: Date | null; created_at: Date}
  greenfield_recovery_tokens: {token_id: string; account_id: string; token_hash: string; expires_at: Date; consumed_at: Date | null; created_at: Date}
  greenfield_sessions: {session_id: string; account_id: string; status: 'active' | 'revoked' | 'expired'; family_id: string; created_at: Date; expires_at: Date; revoked_at: Date | null; last_seen_at: Date; user_agent: string | null; ip_hash: string | null}
  greenfield_session_tokens: {token_id: string; session_id: string; kind: 'access' | 'refresh'; token_hash: string; family_id: string; expires_at: Date; rotated_at: Date | null; reused_at: Date | null; revoked_at: Date | null; created_at: Date}
  greenfield_session_events: {event_id: string; session_id: string | null; account_id: string; event_type: string; metadata: unknown; created_at: Date}
  greenfield_repositories: {repository_id: string; account_id: string; name: string; head_hash: string | null; revision: number; created_at: Date; updated_at: Date}
  greenfield_collections: {collection_id: string; repository_id: string; name: string; schema_id: string; created_at: Date}
  greenfield_records: {record_id: string; repository_id: string; collection: string; schema_id: string; schema_version: number; visibility: 'public' | 'followers' | 'teams' | 'private' | 'system'; data: unknown; revision: number; created_at: Date; updated_at: Date; deleted_at: Date | null}
  greenfield_record_events: {event_id: string; record_id: string; repository_id: string; operation: string; revision: number; previous_hash: string | null; event_hash: string; payload_hash: string; created_at: Date}
  greenfield_checkpoints: {checkpoint_id: string; repository_id: string; head_hash: string; revision: number; signature: string; public_key: string; created_at: Date}
  greenfield_schemas: {schema_id: string; owner: string; status: string; created_at: Date; updated_at: Date}
  greenfield_schema_versions: {schema_version_id: string; schema_id: string; version: number; definition: unknown; visibility_allowance: unknown; validation_limits: unknown; created_at: Date}
  greenfield_extensions: {extension_id: string; slug: string; publisher_account_id: string | null; status: string; created_at: Date; updated_at: Date}
  greenfield_extension_versions: {extension_version_id: string; extension_id: string; version: string; manifest: unknown; status: string; created_at: Date}
  greenfield_extension_installations: {installation_id: string; extension_version_id: string; account_id: string; status: string; config: unknown; created_at: Date; updated_at: Date}
  greenfield_extension_capabilities: {capability_id: string; installation_id: string; capability: string; granted_at: Date; revoked_at: Date | null}
  greenfield_functions: {function_id: string; extension_version_id: string | null; name: string; kind: 'remoteHttp' | 'background' | 'native'; config: unknown; timeout_ms: number; created_at: Date}
  greenfield_tools: {tool_id: string; slug: string; display_name: string; availability: string; manifest: unknown; created_at: Date; updated_at: Date}
  greenfield_plugins: {plugin_id: string; extension_version_id: string | null; manifest: unknown; created_at: Date}
  greenfield_connectors: {connector_id: string; extension_version_id: string | null; manifest: unknown; created_at: Date}
  greenfield_widgets: {widget_id: string; extension_version_id: string | null; manifest: unknown; created_at: Date}
  greenfield_bridges: {bridge_id: string; slug: string; status: string; config: unknown; created_at: Date}
  greenfield_repository_exports: {export_id: string; repository_id: string; status: string; location: string | null; created_at: Date; expires_at: Date | null}
  greenfield_reactions: {reaction_id: string; actor_id: string; post_id: string; reaction_type: 'like' | 'love' | 'celebrate' | 'insightful' | 'support' | 'funny'; created_at: Date; updated_at: Date}
  greenfield_comments: {comment_id: string; post_id: string; author_actor_id: string; parent_comment_id: string | null; root_comment_id: string | null; text: string; depth: number; reply_count: number; version: number; created_at: Date; updated_at: Date; deleted_at: Date | null; deletion_kind: 'user' | 'moderation' | null}
  greenfield_comment_reactions: {reaction_id: string; actor_id: string; comment_id: string; reaction_type: 'like' | 'love' | 'celebrate' | 'insightful' | 'support' | 'funny'; created_at: Date; updated_at: Date}
  greenfield_quote_posts: {post_id: string; quoted_post_id: string; commentary: string; created_at: Date}
  greenfield_mentions: {mention_id: string; source_type: 'post' | 'comment'; source_id: string; mentioned_account_id: string; mentioned_actor_id: string | null; handle_at_mention: string; created_at: Date}
  greenfield_notification_batches: {batch_id: string; recipient_actor_id: string; kind: string; subject_type: string; subject_id: string; batch_key: string; actor_ids: unknown; count: number; preview_text: string | null; created_at: Date; updated_at: Date}
  greenfield_notification_delivery: {delivery_id: string; notification_id: string | null; batch_id: string | null; channel: 'inApp'; status: string; created_at: Date}
  greenfield_appearance_preferences: {account_id: string; mode: 'system' | 'light' | 'dim' | 'dark' | 'oled'; variant: 'standard' | 'forest' | 'ocean' | 'plum' | 'espresso' | 'spaceGray'; surface: 'native' | 'solid' | 'glass' | 'glay' | 'minimalSpatial' | 'skeuomorphic' | 'neomorphic'; accent_id: string; custom_accent: string | null; text_scale: number; bold_text: boolean; reduce_motion: boolean; reduce_transparency: boolean; increase_contrast: boolean; version: number; updated_at: Date}
  greenfield_extension_catalogue: {extension_id: string; slug: string; kind: string; name: string; description: string; version: string; publisher: string; trust: string; permissions: unknown; compatibility: unknown; manifest: unknown; catalogue_status: string; executable: boolean; created_at: Date; updated_at: Date}
  greenfield_extension_lifecycle_events: {event_id: string; account_id: string; extension_id: string; event: string; from_status: string | null; to_status: string | null; detail: unknown; created_at: Date}
  greenfield_extension_failures: {failure_id: string; account_id: string; extension_id: string; installation_id: string | null; code: string; message: string; retryable: boolean; created_at: Date}
  greenfield_function_jobs: {job_id: string; account_id: string; function_id: string; status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'expired'; input: unknown; output: unknown | null; error_message: string | null; created_at: Date; started_at: Date | null; completed_at: Date | null; expires_at: Date}
}
