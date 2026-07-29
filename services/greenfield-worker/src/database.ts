import {Kysely, PostgresDialect} from 'kysely'
import pg from 'pg'

export type BackgroundJobStatus = 'pending' | 'leased' | 'completed' | 'failed' | 'dead_letter'
export type EventVisibility = 'public' | 'account' | 'actor' | 'internal' | 'restricted'
export type EventDataClassification = 'public' | 'internal' | 'private' | 'sensitive' | 'restricted'
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
export type AtprotoConnectionStatus = 'pending' | 'connected' | 'refreshRequired' | 'revoked' | 'disconnected' | 'error'
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
  notifications: {
    id: string
    recipient_actor_id: string
    actor_id: string | null
    type: 'follow' | 'like' | 'repost' | 'reply' | 'mention' | 'module_event'
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
    default_mode: 'modulaOnly' | 'askEveryTime' | 'crossPostPublic'
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
  posts: {
    id: string
    author_actor_id: string
    text: string | null
    search_vector: unknown
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
  }
  profiles: {
    id: string
    actor_id: string
    handle: string
    display_name: string
    bio: string
    search_vector: unknown
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
  }
  actors: {
    id: string
    kind: string
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
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
  greenfield_extension_installations: {
    installation_id: string
    extension_version_id: string
    account_id: string
    status: string
    config: unknown
    created_at: Date
    updated_at: Date
  }
  greenfield_extension_versions: {
    extension_version_id: string
    extension_id: string
    version: string
    manifest: unknown
    status: string
    created_at: Date
  }
  greenfield_extension_lifecycle_events: {
    event_id: string
    account_id: string
    extension_id: string
    event: string
    from_status: string | null
    to_status: string | null
    detail: unknown
    created_at: Date
  }
  greenfield_module_install_plans: {
    plan_id: string
    account_id: string
    release_id: string
    installation_id: string | null
    requested_version: string
    resolved_dependencies: unknown
    permission_decision: unknown
    status: 'created' | 'queued' | 'claimed' | 'completed' | 'failed' | 'cancelled'
    idempotency_key: string
    created_at: Date
    updated_at: Date
  }
  greenfield_module_permission_reviews: {
    review_id: string
    installation_id: string | null
    release_id: string
    account_id: string
    granted_permissions: unknown
    denied_permissions: unknown
    high_risk_increase: boolean
    idempotency_key: string
    reviewed_at: Date
  }
  greenfield_module_releases: {
    release_id: string
    module_version_id: string
    extension_id: string
    extension_version_id: string
    module_id: string
    version: string
    publisher_id: string
    release_state: string
    source_repository: string
    source_commit: string
    manifest_path: string
    manifest_sha256: string
    release_sha256: string | null
    signature_key_id: string | null
    signature: string | null
    compatibility: unknown
    license_status: string
    trust_level: string
    published_at: Date | null
    quarantined_at: Date | null
    revoked_at: Date | null
    superseded_at: Date | null
    created_at: Date
    updated_at: Date
  }
  greenfield_module_contributions: {
    contribution_id: string
    release_id: string
    module_id: string
    contribution_type: string
    contribution_key: string
    manifest: unknown
    execution_required: boolean
    registration_status: string
    created_at: Date
    updated_at: Date
  }
  greenfield_module_views: {
    view_id: string
    release_id: string
    module_id: string
    view_key: string
    view_kind: string
    collection: string | null
    title: string
    declaration: unknown
    required_capabilities: unknown
    registration_status: string
    created_at: Date
    updated_at: Date
  }
  greenfield_module_actions: {
    action_row_id: string
    release_id: string
    module_id: string
    action_id: string
    action_kind: string
    capability: string
    declaration: unknown
    registration_status: string
    created_at: Date
    updated_at: Date
  }
  greenfield_module_record_collections: {
    collection_id: string
    release_id: string
    module_id: string
    collection: string
    schema_ref: string
    default_visibility: string
    fields: unknown
    searchable_fields: unknown
    filterable_fields: unknown
    sortable_fields: unknown
    folder_field: string | null
    reference_fields: unknown
    schema_definition: unknown
    retention_policy: string
    registration_status: string
    created_at: Date
    updated_at: Date
  }
  greenfield_module_records: {
    record_id: string
    account_id: string
    module_id: string
    installation_id: string | null
    collection: string
    schema_ref: string
    visibility: string
    data: unknown
    search_text: string
    folder_ref: string | null
    source_uri: string | null
    retained_after_uninstall: boolean
    revision: number
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
  }
  greenfield_module_data_retention: {
    retention_id: string
    account_id: string
    module_id: string
    installation_id: string | null
    choice: 'keepData' | 'exportThenDelete' | 'deleteData'
    record_count: number
    export_id: string | null
    completed_at: Date | null
    created_at: Date
  }
  greenfield_module_release_integrity: {
    integrity_id: string
    release_id: string
    manifest_sha256: string
    release_sha256: string | null
    schema_sha256: unknown
    settings_schema_sha256: string | null
    source_commit: string
    verified_at: Date | null
    mismatch_at: Date | null
  }
  greenfield_module_installation_settings: {
    settings_id: string
    installation_id: string
    module_id: string
    scope: 'account' | 'installation' | 'team'
    schema_version: number
    values: unknown
    secret_refs: unknown
    version: number
    updated_by: string | null
    updated_at: Date
  }
  greenfield_tools: {
    tool_id: string
    slug: string
    display_name: string
    availability: string
    manifest: unknown
    created_at: Date
    updated_at: Date
  }
  greenfield_functions: {
    function_id: string
    extension_version_id: string | null
    name: string
    kind: 'remoteHttp' | 'background' | 'native'
    config: unknown
    timeout_ms: number
    created_at: Date
  }
  greenfield_widgets: {
    widget_id: string
    extension_version_id: string | null
    manifest: unknown
    created_at: Date
  }
  greenfield_plugins: {
    plugin_id: string
    extension_version_id: string | null
    manifest: unknown
    created_at: Date
  }
  greenfield_connectors: {
    connector_id: string
    extension_version_id: string | null
    manifest: unknown
    created_at: Date
  }
}

export type ModulaWorkerDb = Kysely<Database>
export type WorkerDb = ModulaWorkerDb

export function createDb(connectionString: string): ModulaWorkerDb {
  const pool = new pg.Pool({
    connectionString,
    max: 5,
    application_name: 'modula-worker',
  })
  return new Kysely<Database>({
    dialect: new PostgresDialect({pool}),
  })
}

export const createWorkerDb = createDb
