import {Kysely, PostgresDialect} from 'kysely'
import pg from 'pg'

export type BackgroundJobStatus = 'pending' | 'leased' | 'completed' | 'failed' | 'dead_letter'
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
  notifications: {
    id: string
    recipient_actor_id: string
    actor_id: string | null
    type: 'follow' | 'like' | 'repost' | 'reply' | 'mention' | 'module_event'
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
    event_type: string
    actor_id: string | null
    resource_type: string | null
    resource_id: string | null
    metadata: unknown
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
