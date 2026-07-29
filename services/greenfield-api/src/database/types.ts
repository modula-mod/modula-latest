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
export type EventVisibility = 'public' | 'account' | 'actor' | 'internal' | 'restricted'
export type EventDataClassification = 'public' | 'internal' | 'private' | 'sensitive' | 'restricted'
export type PolicyDecisionCode =
  | 'ALLOWED'
  | 'RESOURCE_NOT_VISIBLE'
  | 'MODULE_NOT_ENABLED'
  | 'MODULE_PERMISSION_MISSING'
  | 'AI_CONTEXT_NOT_ALLOWED'
  | 'CONNECTION_NOT_HEALTHY'
  | 'REAUTHENTICATION_REQUIRED'
  | 'TRANSACTION_CONFIRMATION_REQUIRED'
  | 'ADMIN_ROLE_REQUIRED'
  | 'FORBIDDEN'
export type NotificationCategory = 'social' | 'module' | 'AI' | 'connector' | 'automation' | 'security' | 'system' | 'DIMON' | 'marketplace'
export type NotificationChannel = 'in-app' | 'email' | 'web-push'
export type NotificationFrequency = 'immediate' | 'hourly' | 'daily' | 'weekly' | 'manual'
export type GreenfieldEventDeliveryTargetType =
  | 'notification'
  | 'search-index'
  | 'ai-index'
  | 'analytics'
  | 'automation'
  | 'dimon-anchor'
  | 'connector-sync'
  | 'background-job'
  | 'internal-subscriber'
export type GreenfieldEventDeliveryStatus =
  | 'pending'
  | 'leased'
  | 'processing'
  | 'completed'
  | 'retrying'
  | 'dead_lettered'
  | 'cancelled'
export type GreenfieldSearchEntityType = 'post' | 'profile' | 'module' | 'module-release'
export type GreenfieldSearchVisibility = 'public' | 'followers' | 'private' | 'account' | 'system'
export type GreenfieldSearchDocumentStatus = 'active' | 'deleted' | 'hidden' | 'quarantined' | 'unavailable'
export type GreenfieldSearchReindexMode = 'single-entity' | 'entity-type' | 'account-scope' | 'full-index'
export type GreenfieldSearchReindexState = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed'
export type GreenfieldModuleReleaseState =
  | 'draft'
  | 'pendingReview'
  | 'verified'
  | 'published'
  | 'quarantined'
  | 'revoked'
  | 'superseded'
export type GreenfieldPublisherStatus = 'pending' | 'verified' | 'suspended' | 'revoked'
export type GreenfieldModuleTrustLevel = 'firstParty' | 'verifiedPublisher' | 'reviewedCommunity' | 'untrustedManifest'
export type GreenfieldModuleLicenseStatus = 'firstParty' | 'verified' | 'declared' | 'founderOverride' | 'unknown' | 'denied'
export type GreenfieldModuleViewKind = 'collection' | 'detail' | 'form' | 'dashboard' | 'settings' | 'emptyState'
export type GreenfieldModuleActionKind =
  | 'route.open'
  | 'record.create'
  | 'record.update'
  | 'record.delete'
  | 'record.query'
  | 'function.invoke'
  | 'settings.update'
  | 'share'
  | 'dismiss'
export type GreenfieldModuleRuntimeRegistrationStatus = 'declared' | 'registered' | 'disabled' | 'quarantined' | 'revoked'
export type GreenfieldModuleRuntimeVisibility = 'private' | 'teams' | 'followers' | 'public' | 'system'
export type GreenfieldModuleRetentionPolicy = 'keepOnUninstall' | 'deleteOnUninstall' | 'exportRequired'
export type GreenfieldModuleDataRetentionChoice = 'keepData' | 'exportThenDelete' | 'deleteData'
export type GreenfieldDistributionModel = 'free' | 'included' | 'internal' | 'futurePaid' | 'futureSubscription'
export type GreenfieldRuntimeSessionKind =
  | 'module'
  | 'connector-operation'
  | 'ai-conversation'
  | 'ai-tool-run'
  | 'automation-run'
export type GreenfieldRuntimeSessionState =
  | 'creating'
  | 'resolving'
  | 'preparing'
  | 'ready'
  | 'starting'
  | 'active'
  | 'suspending'
  | 'suspended'
  | 'resuming'
  | 'stopping'
  | 'terminated'
  | 'failed'
  | 'recovering'
export type GreenfieldRuntimeCompatibility = 'compatible' | 'degraded' | 'blocked'
export type GreenfieldRuntimeLaunchPermission = 'allowed' | 'degraded-only' | 'denied'
export type GreenfieldConnectorProviderType = 'first-party' | 'trusted-provider' | 'generic' | 'metadata-only'
export type GreenfieldConnectorAuthorisationMethod = 'oauth2' | 'api-key' | 'personal-access-token' | 'signed-webhook' | 'none'
export type GreenfieldConnectorConfigurationState = 'configured' | 'not-configured' | 'invalid'
export type GreenfieldConnectorAvailabilityStatus = 'available' | 'unavailable' | 'coming-later'
export type GreenfieldConnectorHealthStatus = 'not-checked' | 'healthy' | 'degraded' | 'unhealthy' | 'unavailable'
export type GreenfieldConnectionState = 'available' | 'authorising' | 'connected' | 'refreshing' | 'degraded' | 'expired' | 'revoked' | 'disabled' | 'failed' | 'disconnected'
export type GreenfieldConnectionPermissionState = 'requested' | 'granted' | 'denied' | 'revoked'
export type GreenfieldConnectionSyncStatus = 'idle' | 'queued' | 'syncing' | 'succeeded' | 'failed'
export type GreenfieldConnectorOAuthStateStatus = 'created' | 'authorising' | 'consumed' | 'expired' | 'cancelled' | 'failed'
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
    audit_id: string
    event_type: string
    account_id: string | null
    actor_id: string | null
    action: string
    resource_type: string | null
    resource_id: string | null
    result: 'succeeded' | 'denied' | 'failed' | 'cancelled'
    request_id: string | null
    correlation_id: string | null
    ip_classification: 'unknown' | 'local' | 'private' | 'public' | 'trusted-proxy'
    user_agent_classification: 'unknown' | 'browser' | 'mobile' | 'service' | 'bot' | 'cli'
    metadata_schema_version: number
    metadata: unknown
    created_at: Date
  }
  greenfield_policy_decision_audit: {
    decision_id: string
    actor_id: string | null
    account_id: string | null
    action: string
    capability: string | null
    resource_type: string | null
    resource_id: string | null
    resource_owner_actor_id: string | null
    module_id: string | null
    connection_id: string | null
    allowed: boolean
    code: PolicyDecisionCode
    obligations: unknown
    audit_required: boolean
    risk_classification: string | null
    request_id: string | null
    correlation_id: string | null
    context: unknown
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
  greenfield_domain_events: {
    event_id: string
    event_type: string
    event_version: string
    aggregate_type: string
    aggregate_id: string
    aggregate_version: number | null
    account_id: string | null
    actor_id: string | null
    request_id: string
    correlation_id: string
    causation_id: string | null
    idempotency_key: string | null
    visibility: EventVisibility
    classification: EventDataClassification
    payload: unknown
    metadata: unknown
    occurred_at: Date
    recorded_at: Date
  }
  greenfield_event_schema_registry: {
    event_type: string
    event_version: string
    owner: string
    aggregate_type: string
    json_schema: unknown
    compatibility_policy: string
    retention_policy: string
    data_classification: EventDataClassification
    permitted_subscribers: unknown
    replay_policy: 'safe-idempotent' | 'guarded-idempotent' | 'manual-approval-required' | 'not-replayable'
    lifecycle_state: 'active' | 'deprecated' | 'retired'
    created_at: Date
    updated_at: Date
  }
  greenfield_event_subscriptions: {
    subscription_id: string
    event_type: string
    subscriber_id: string
    target_type: GreenfieldEventDeliveryTargetType
    target_key: string
    filters: unknown
    enabled: boolean
    permitted_visibility: EventVisibility[]
    permitted_classifications: EventDataClassification[]
    subscriber_timeout_ms: number
    max_concurrency: number
    created_at: Date
    updated_at: Date
  }
  greenfield_event_deliveries: {
    delivery_id: string
    event_id: string
    subscriber_id: string
    target_type: GreenfieldEventDeliveryTargetType
    target_key: string
    status: GreenfieldEventDeliveryStatus
    payload: unknown
    available_at: Date
    lease_owner: string | null
    lease_expires_at: Date | null
    attempt_count: number
    maximum_attempts: number
    failure_code: string | null
    failure_message: string | null
    delivered_at: Date | null
    created_at: Date
    updated_at: Date
  }
  greenfield_event_inbox: {
    subscriber_id: string
    event_id: string
    processing_state: 'received' | 'processing' | 'completed' | 'failed' | 'skipped'
    first_received_at: Date
    last_attempted_at: Date | null
    completed_at: Date | null
    attempt_count: number
    failure_code: string | null
  }
  greenfield_event_replay_requests: {
    replay_id: string
    mode: 'event' | 'event_type' | 'date_range' | 'aggregate' | 'dead_letters'
    requested_by_actor_id: string | null
    reason: string
    request_id: string
    correlation_id: string
    selector: unknown
    dry_run: boolean
    state: 'planned' | 'running' | 'completed' | 'cancelled' | 'failed'
    planned_count: number
    replayed_count: number
    failure_code: string | null
    created_at: Date
    updated_at: Date
    completed_at: Date | null
  }
  search_documents: {
    document_id: string
    schema_version: '1.0.0'
    entity_type: GreenfieldSearchEntityType
    entity_id: string
    source_version: number
    account_id: string | null
    owner_id: string | null
    title: string | null
    body: string | null
    summary: string | null
    keywords: string[]
    tags: string[]
    visibility: GreenfieldSearchVisibility
    status: GreenfieldSearchDocumentStatus
    language: string | null
    metadata: unknown
    created_at: Date
    updated_at: Date
    indexed_at: Date
    search_vector: unknown
  }
  search_projection_state: {
    projector_id: string
    entity_type: GreenfieldSearchEntityType
    last_event_id: string | null
    last_processed_at: Date | null
    last_success_at: Date | null
    last_failure_at: Date | null
    last_failure_code: string | null
    processed_count: number
    failed_count: number
    lag_seconds: number
  }
  search_projection_failures: {
    failure_id: string
    projector_id: string
    event_id: string
    entity_type: GreenfieldSearchEntityType
    entity_id: string
    failure_code: string
    attempt_count: number
    first_failed_at: Date
    last_failed_at: Date
    resolved_at: Date | null
    sanitised_details: unknown
  }
  saved_searches: {
    saved_search_id: string
    account_id: string
    name: string
    query: string
    filters: unknown
    created_at: Date
    updated_at: Date
  }
  recent_searches: {
    recent_search_id: string
    account_id: string
    query: string
    normalized_query: string
    filters: unknown
    searched_at: Date
    created_at: Date
  }
  search_query_metrics: {
    request_id: string
    account_id: string | null
    actor_id: string | null
    entity_types: string[]
    took_ms: number
    result_count: number
    created_at: Date
  }
  search_reindex_requests: {
    reindex_id: string
    mode: GreenfieldSearchReindexMode
    entity_type: GreenfieldSearchEntityType | null
    entity_id: string | null
    account_id: string | null
    dry_run: boolean
    reason: string
    requested_by_actor_id: string | null
    request_id: string
    correlation_id: string
    state: GreenfieldSearchReindexState
    processed_count: number
    failure_code: string | null
    cancellation_requested_at: Date | null
    created_at: Date
    updated_at: Date
    completed_at: Date | null
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
    category: NotificationCategory
    channels: unknown
    dedupe_key: string | null
    aggregate_count: number
    aggregate_window_started_at: Date | null
    last_aggregated_at: Date | null
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
    reaction_enabled: boolean
    repost_enabled: boolean
    quote_enabled: boolean
    reply_enabled: boolean
    comment_enabled: boolean
    mention_enabled: boolean
    module_event_enabled: boolean
    extension_enabled: boolean
    in_app_enabled: boolean
    email_enabled: boolean
    web_push_enabled: boolean
    frequency: NotificationFrequency
    digest_mode: boolean
    quiet_hours: unknown
    channel_preferences: unknown
    category_preferences: unknown
    module_preferences: unknown
    connector_failure_enabled: boolean
    ai_completion_enabled: boolean
    automation_failure_enabled: boolean
    dimon_transaction_confirmation_enabled: boolean
    bundle_style: 'individual' | 'focus' | 'digest'
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
  greenfield_reactions: {reaction_id: string; actor_id: string; post_id: string; reaction_type: 'like' | 'celebrate' | 'insightful' | 'support' | 'curious'; created_at: Date; updated_at: Date}
  greenfield_comments: {comment_id: string; post_id: string; author_actor_id: string; parent_comment_id: string | null; root_comment_id: string | null; text: string; depth: number; reply_count: number; version: number; created_at: Date; updated_at: Date; deleted_at: Date | null; deletion_kind: 'user' | 'moderation' | null}
  greenfield_comment_reactions: {reaction_id: string; actor_id: string; comment_id: string; reaction_type: 'like' | 'celebrate' | 'insightful' | 'support' | 'curious'; created_at: Date; updated_at: Date}
  greenfield_quote_posts: {post_id: string; quoted_post_id: string; commentary: string; created_at: Date}
  greenfield_mentions: {mention_id: string; source_type: 'post' | 'comment'; source_id: string; mentioned_account_id: string; mentioned_actor_id: string | null; handle_at_mention: string; created_at: Date}
  greenfield_notification_batches: {batch_id: string; recipient_actor_id: string; kind: string; subject_type: string; subject_id: string; batch_key: string; actor_ids: unknown; count: number; preview_text: string | null; created_at: Date; updated_at: Date}
  greenfield_notification_delivery: {delivery_id: string; notification_id: string | null; batch_id: string | null; channel: 'inApp'; status: string; created_at: Date}
  greenfield_appearance_preferences: {account_id: string; mode: 'system' | 'light' | 'dim' | 'dark' | 'oled'; variant: 'standard' | 'forest' | 'ocean' | 'plum' | 'espresso' | 'spaceGray'; surface: 'native' | 'solid' | 'glass' | 'glay' | 'minimalSpatial' | 'skeuomorphic' | 'neomorphic'; accent_id: string; custom_accent: string | null; text_scale: number; bold_text: boolean; reduce_motion: boolean; reduce_transparency: boolean; increase_contrast: boolean; version: number; updated_at: Date}
  greenfield_board_layouts: {account_id: string; board_widget_ids: unknown; version: number; updated_at: Date}
  greenfield_extension_catalogue: {extension_id: string; slug: string; kind: string; name: string; description: string; version: string; publisher: string; trust: string; permissions: unknown; compatibility: unknown; manifest: unknown; catalogue_status: string; executable: boolean; distribution_model: GreenfieldDistributionModel; entitlement_id: string | null; created_at: Date; updated_at: Date}
  greenfield_extension_lifecycle_events: {event_id: string; account_id: string; extension_id: string; event: string; from_status: string | null; to_status: string | null; detail: unknown; created_at: Date}
  greenfield_extension_failures: {failure_id: string; account_id: string; extension_id: string; installation_id: string | null; code: string; message: string; retryable: boolean; created_at: Date}
  greenfield_function_jobs: {job_id: string; account_id: string; function_id: string; status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'expired'; input: unknown; output: unknown | null; error_message: string | null; created_at: Date; started_at: Date | null; completed_at: Date | null; expires_at: Date}
  greenfield_publishers: {publisher_id: string; display_name: string; website: string | null; status: GreenfieldPublisherStatus; trust_level: GreenfieldModuleTrustLevel; created_at: Date; updated_at: Date; verified_at: Date | null; suspended_at: Date | null; revoked_at: Date | null}
  greenfield_publisher_namespaces: {namespace: string; publisher_id: string; verification_method: string; verification_evidence: unknown; verified_at: Date | null; revoked_at: Date | null; created_at: Date}
  greenfield_module_versions: {module_version_id: string; extension_version_id: string; module_id: string; version: string; publisher_id: string; manifest: unknown; status: GreenfieldModuleReleaseState; created_at: Date; updated_at: Date}
  greenfield_module_releases: {release_id: string; module_version_id: string; extension_id: string; extension_version_id: string; module_id: string; version: string; publisher_id: string; release_state: GreenfieldModuleReleaseState; source_repository: string; source_commit: string; manifest_path: string; manifest_sha256: string; release_sha256: string | null; signature_key_id: string | null; signature: string | null; compatibility: unknown; license_status: GreenfieldModuleLicenseStatus; trust_level: GreenfieldModuleTrustLevel; published_at: Date | null; quarantined_at: Date | null; revoked_at: Date | null; superseded_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_module_sources: {source_id: string; release_id: string; provider: 'github'; repository: string; repository_id: string | null; default_branch: string | null; commit: string; manifest_path: string; release_tag: string | null; release_asset_name: string | null; fetched_at: Date; etag: string | null}
  greenfield_module_dependencies: {dependency_id: string; release_id: string; module_id: string; dependency_module_id: string; version_range: string; optional: boolean; reason: string | null; created_at: Date}
  greenfield_module_permissions: {permission_id: string; release_id: string; permission: string; reason: string; risk: 'low' | 'medium' | 'high' | 'restricted'; requested_at: Date}
  greenfield_module_permission_reviews: {review_id: string; installation_id: string | null; release_id: string; account_id: string; granted_permissions: unknown; denied_permissions: unknown; high_risk_increase: boolean; idempotency_key: string; reviewed_at: Date}
  greenfield_module_install_plans: {plan_id: string; account_id: string; release_id: string; installation_id: string | null; requested_version: string; resolved_dependencies: unknown; permission_decision: unknown; status: 'created' | 'queued' | 'claimed' | 'completed' | 'failed' | 'cancelled'; idempotency_key: string; created_at: Date; updated_at: Date}
  greenfield_module_contributions: {contribution_id: string; release_id: string; module_id: string; contribution_type: 'route' | 'profileTab' | 'boardSurface' | 'setting' | 'schema' | 'tool' | 'function' | 'widget' | 'plugin' | 'connector' | 'job' | 'event'; contribution_key: string; manifest: unknown; execution_required: boolean; registration_status: 'declared' | 'registered' | 'disabled' | 'quarantined' | 'revoked'; created_at: Date; updated_at: Date}
  greenfield_module_license_evidence: {evidence_id: string; release_id: string; evidence_type: 'rootLicense' | 'packageMetadata' | 'readmeDeclaration' | 'registryMetadata' | 'maintainerStatement' | 'founderOverride' | 'firstPartyPolicy'; summary: string; source_path: string | null; checksum: string | null; created_at: Date}
  greenfield_module_release_integrity: {integrity_id: string; release_id: string; manifest_sha256: string; release_sha256: string | null; schema_sha256: unknown; settings_schema_sha256: string | null; source_commit: string; verified_at: Date | null; mismatch_at: Date | null}
  greenfield_module_release_signatures: {signature_id: string; release_id: string; signature_key_id: string; signature: string; algorithm: string; verified_at: Date | null; revoked_at: Date | null}
  greenfield_module_installation_settings: {settings_id: string; installation_id: string; module_id: string; scope: 'account' | 'installation' | 'team'; schema_version: number; values: unknown; secret_refs: unknown; version: number; updated_by: string | null; updated_at: Date}
  greenfield_module_settings_versions: {settings_version_id: string; settings_id: string; version: number; values: unknown; secret_refs: unknown; changed_by: string | null; created_at: Date}
  greenfield_module_sync_sources: {sync_source_id: string; provider: 'github'; repository: string; enabled: boolean; config: unknown; created_at: Date; updated_at: Date}
  greenfield_module_sync_runs: {sync_run_id: string; sync_source_id: string | null; status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'; started_at: Date | null; completed_at: Date | null; summary: unknown; created_at: Date}
  greenfield_module_sync_failures: {sync_failure_id: string; sync_run_id: string | null; repository: string | null; code: string; message: string; retryable: boolean; created_at: Date}
  greenfield_module_quarantines: {quarantine_id: string; release_id: string; reason: string; policy_action: 'warn' | 'disableExecutableContributions' | 'block'; created_by: string | null; created_at: Date; lifted_at: Date | null}
  greenfield_module_revocations: {revocation_id: string; scope: 'release' | 'module' | 'publisher' | 'signingKey'; target_id: string; reason: string; created_by: string | null; created_at: Date}
  greenfield_module_views: {view_id: string; release_id: string; module_id: string; view_key: string; view_kind: GreenfieldModuleViewKind; collection: string | null; title: string; declaration: unknown; required_capabilities: unknown; registration_status: GreenfieldModuleRuntimeRegistrationStatus; created_at: Date; updated_at: Date}
  greenfield_module_actions: {action_row_id: string; release_id: string; module_id: string; action_id: string; action_kind: GreenfieldModuleActionKind; capability: string; declaration: unknown; registration_status: GreenfieldModuleRuntimeRegistrationStatus; created_at: Date; updated_at: Date}
  greenfield_module_record_collections: {collection_id: string; release_id: string; module_id: string; collection: string; schema_ref: string; default_visibility: GreenfieldModuleRuntimeVisibility; fields: unknown; searchable_fields: unknown; filterable_fields: unknown; sortable_fields: unknown; folder_field: string | null; reference_fields: unknown; schema_definition: unknown; retention_policy: GreenfieldModuleRetentionPolicy; registration_status: GreenfieldModuleRuntimeRegistrationStatus; created_at: Date; updated_at: Date}
  greenfield_module_records: {record_id: string; account_id: string; module_id: string; installation_id: string | null; collection: string; schema_ref: string; visibility: GreenfieldModuleRuntimeVisibility; data: unknown; search_text: string; folder_ref: string | null; source_uri: string | null; retained_after_uninstall: boolean; revision: number; created_at: Date; updated_at: Date; deleted_at: Date | null}
  greenfield_module_record_events: {event_id: string; record_id: string; account_id: string; module_id: string; collection: string; operation: 'create' | 'update' | 'delete' | 'restore' | 'move'; revision: number; previous_hash: string | null; event_hash: string; payload_hash: string; metadata: unknown; created_at: Date}
  greenfield_module_action_events: {event_id: string; account_id: string; module_id: string; action_id: string; action_kind: GreenfieldModuleActionKind; idempotency_key: string | null; status: 'validated' | 'completed' | 'failed' | 'queued' | 'cancelled'; input_hash: string; result: unknown; error_code: string | null; created_at: Date}
  greenfield_module_data_retention: {retention_id: string; account_id: string; module_id: string; installation_id: string | null; choice: GreenfieldModuleDataRetentionChoice; record_count: number; export_id: string | null; completed_at: Date | null; created_at: Date}
  greenfield_runtime_sessions: {session_id: string; session_kind: GreenfieldRuntimeSessionKind; account_id: string; module_id: string | null; installation_id: string | null; release_id: string | null; provider_ids: unknown; state: GreenfieldRuntimeSessionState; compatibility: GreenfieldRuntimeCompatibility | null; launch_permission: GreenfieldRuntimeLaunchPermission | null; resolution: unknown; reason_codes: unknown; metadata: unknown; failure_code: string | null; failure_message: string | null; created_at: Date; updated_at: Date; started_at: Date | null; terminated_at: Date | null}
  greenfield_runtime_session_events: {event_id: string; session_id: string; account_id: string; event_type: string; from_state: GreenfieldRuntimeSessionState | null; to_state: GreenfieldRuntimeSessionState | null; reason_codes: unknown; metadata: unknown; created_at: Date}
  greenfield_connector_providers: {provider_id: string; display_name: string; provider_type: GreenfieldConnectorProviderType; connector_kinds: unknown; capabilities: unknown; authorisation_method: GreenfieldConnectorAuthorisationMethod; required_configuration: unknown; configured_status: GreenfieldConnectorConfigurationState; availability_status: GreenfieldConnectorAvailabilityStatus; health_status: GreenfieldConnectorHealthStatus; icon_ref: string; privacy_summary: string; data_access_summary: string; supported_actions: unknown; sync_support: unknown; webhook_support: unknown; rate_limit_policy: unknown; adapter_trusted: boolean; operational: boolean; created_at: Date; updated_at: Date}
  greenfield_connections: {connection_id: string; account_id: string; provider_id: string; display_name: string; external_account_id: string | null; external_account_label: string | null; external_identity_metadata: unknown; state: GreenfieldConnectionState; enabled: boolean; health_status: GreenfieldConnectorHealthStatus; health_checked_at: Date | null; health_reason_code: string | null; connected_at: Date | null; last_refreshed_at: Date | null; last_used_at: Date | null; expires_at: Date | null; revoked_at: Date | null; revocation_reason: string | null; revoked_by: string | null; revocation_metadata: unknown; failure_code: string | null; last_transition_idempotency_key: string | null; created_at: Date; updated_at: Date}
  greenfield_connection_credentials: {credential_id: string; connection_id: string; key_version: string; encryption_algorithm: string; nonce: Buffer | null; auth_tag: Buffer | null; encrypted_payload: Buffer | null; encrypted_access_token: Buffer | null; encrypted_refresh_token: Buffer | null; encrypted_auxiliary_data: Buffer | null; token_type: string | null; expires_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_connection_scopes: {scope_id: string; connection_id: string; scope: string; granted_at: Date; revoked_at: Date | null}
  greenfield_connection_permissions: {permission_id: string; connection_id: string; capability: string; state: GreenfieldConnectionPermissionState; reason: string | null; granted_at: Date | null; revoked_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_connection_sync_state: {sync_state_id: string; connection_id: string; resource_kind: string; cursor_metadata: unknown; status: GreenfieldConnectionSyncStatus; last_started_at: Date | null; last_completed_at: Date | null; failure_code: string | null; created_at: Date; updated_at: Date}
  greenfield_connection_events: {event_id: string; account_id: string; provider_id: string; connection_id: string | null; event_type: string; from_state: GreenfieldConnectionState | null; to_state: GreenfieldConnectionState | null; metadata: unknown; created_at: Date}
  greenfield_connector_oauth_states: {state_id: string; account_id: string; provider_id: string; state_hash: string; status: GreenfieldConnectorOAuthStateStatus; redirect_uri: string; pkce_challenge: string | null; pkce_challenge_method: 'S256' | null; pkce_verifier_key_version: string | null; pkce_verifier_nonce: Buffer | null; pkce_verifier_auth_tag: Buffer | null; pkce_verifier_ciphertext: Buffer | null; idempotency_key: string | null; failure_code: string | null; failure_message: string | null; created_at: Date; authorising_at: Date | null; expires_at: Date; consumed_at: Date | null; cancelled_at: Date | null; failed_at: Date | null; replay_detected_at: Date | null; consume_attempt_count: number}
}
