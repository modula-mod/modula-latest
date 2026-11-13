# Database to API Map

Production PostgreSQL: 16.9; schema migration `073_backup_sequence_acl_defaults`; 73 applied migrations. Git contains 90 ordered up migrations, latest `090_calls_v1.sql`.

No row values were collected. This inventory is PostgreSQL catalogue metadata plus static source references.

## Reconciliation

- Production tables: 380
- Tables with API/worker source references: 366
- Orphan candidates requiring manual confirmation: 14
- Write-only candidates: 40
- Read-only candidates: 34

## Table inventory

### `activity_items`

- Purpose: application state for activity items
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `activity_items_pkey`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `occurred_at`, `created_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `GET /v1/activity`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/discovery/repository.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `actors`

- Purpose: application state for actors
- Primary key: `id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `actors_account_id_idx`, `actors_pkey`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `GET /v1/accounts/me/blocks`, `POST /v1/accounts/me/handle`, `GET /v1/accounts/me/mutes`, `GET /v1/accounts/me/notification-preferences`, `PATCH /v1/accounts/me/notification-preferences`, `POST /v1/admin/ops/policy/evaluate`, `PUT /v1/admin/qa/premium/:handle`, `POST /v1/admin/qa/verification/appeals/:appealId/transitions`, `POST /v1/admin/qa/verification/applications/:applicationId/transitions`, `POST /v1/ai/requests`, `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `GET /v1/calls/:callId/signalling`, `POST /v1/comments/:commentId/replies`, `POST /v1/communities`, `PATCH /v1/communities/:communityId`, `POST /v1/communities/:communityId/events`, `PATCH /v1/communities/:communityId/events/:eventId`, `PUT /v1/communities/:communityId/events/:eventId/response`, `POST /v1/communities/:communityId/join`, `POST /v1/communities/:communityId/leave`, `POST /v1/communities/:communityId/polls`, `PATCH /v1/communities/:communityId/polls/:pollId`, `PUT /v1/communities/:communityId/polls/:pollId/vote`, `PATCH /v1/communities/:communityId/settings`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `POST /v1/conversations`, `POST /v1/conversations/:id/calls`, `GET /v1/creator/insights`, `POST /v1/groups`, `POST /v1/groups/:id/members`, `POST /v1/in-mail`, `PATCH /v1/me/membership/badge-visibility`, `POST /v1/me/verification/applications`, `POST /v1/modules/:moduleId/ai/requests`, `POST /v1/posts`, `DELETE /v1/posts/:postId`, `PATCH /v1/posts/:postId`, `POST /v1/posts/:postId/comments`, `POST /v1/posts/:postId/quote`, `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`, `PATCH /v1/profiles/me`, `POST /v1/stories`, `POST /v1/stories/:storyId/replies`, `GET /v1/stories/rail`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/accounts/verify-email`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/accounts/service.ts`, `services/greenfield-api/src/ai/gateway-service.ts`, `services/greenfield-api/src/ai/provider-runtime-service.ts`, `services/greenfield-api/src/app/register-routes.ts`, `services/greenfield-api/src/domains/calls/service.ts`, `services/greenfield-api/src/domains/communities/service.ts`, `services/greenfield-api/src/domains/drafts/service.ts`, `services/greenfield-api/src/domains/mentions/service.ts`, `services/greenfield-api/src/domains/messaging/service.ts`, `services/greenfield-api/src/domains/notifications/preferences.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/domains/posts/writes.ts`, `services/greenfield-api/src/domains/profiles/writes.ts`, `services/greenfield-api/src/domains/stories/service.ts`, `services/greenfield-api/src/premium/apple-service.ts`, `services/greenfield-api/src/premium/badges.ts`, `services/greenfield-api/src/premium/service.ts`, `services/greenfield-api/src/premium/verification-service.ts`, `services/greenfield-api/src/security/session.ts`, `services/greenfield-api/src/settings-v2/service.ts`, `services/greenfield-worker/src/digests/digests.ts`, `services/greenfield-worker/src/search/index.ts`, `services/greenfield-worker/src/search/post-projector.ts`, `services/greenfield-worker/src/search/profile-projector.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/accounts/service.ts`
- Disposition: active read/write or ledger/schema table

### `ai_execution_attempts`

- Purpose: AI provider/execution state
- Primary key: `attempt_id`
- Foreign keys: `execution_id -> ai_executions.execution_id`, `model_id -> greenfield_ai_models.model_id`, `provider_id -> greenfield_ai_providers.provider_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `ai_execution_attempts_execution_id_attempt_number_key`, `ai_execution_attempts_execution_idx`, `ai_execution_attempts_pkey`
- Unique constraints: `ai_execution_attempts_execution_id_attempt_number_key(execution_id,attempt_number)`
- Soft delete: none
- Timestamps: `started_at`, `completed_at`
- Migration introduced: `025_phase7e_ai_provider_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/ai/runtime-repository.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `ai_executions`

- Purpose: AI provider/execution state
- Primary key: `execution_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `model_id -> greenfield_ai_models.model_id`, `provider_id -> greenfield_ai_providers.provider_id`, `request_id -> greenfield_ai_request_ledger.request_id`
- Ownership/workspace/user/module columns: `account_id`, `actor_id`, `module_id`, `installation_id`
- Indexes: `ai_executions_account_idx`, `ai_executions_module_idx`, `ai_executions_pkey`, `ai_executions_request_id_key`
- Unique constraints: `ai_executions_request_id_key(request_id)`
- Soft delete: none
- Timestamps: `started_at`, `completed_at`, `cancelled_at`, `failed_at`, `created_at`, `updated_at`
- Migration introduced: `025_phase7e_ai_provider_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/ai/runtime-repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/runtime-repository.ts`
- Disposition: active read/write or ledger/schema table

### `ai_product_action_applications`

- Purpose: AI provider/execution state
- Primary key: `application_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `product_execution_id -> ai_product_action_executions.product_execution_id`
- Ownership/workspace/user/module columns: `account_id`, `module_id`, `installation_id`
- Indexes: `ai_product_action_applications_account_id_idempotency_key_key`, `ai_product_action_applications_pkey`, `ai_product_action_applications_product_execution_id_key`
- Unique constraints: `ai_product_action_applications_account_id_idempotency_key_key(account_id,idempotency_key)`, `ai_product_action_applications_product_execution_id_key(product_execution_id)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `026_phase7e_ai_product_actions.sql`
- Routes reading: `POST /v1/modules/:moduleId/ai/executions/:executionId/apply`
- Routes writing: `POST /v1/modules/:moduleId/ai/executions/:executionId/apply`
- API/worker source reads: `services/greenfield-api/src/ai/product-action-service.ts`
- API/worker source writes: `services/greenfield-api/src/ai/product-action-service.ts`
- Disposition: active read/write or ledger/schema table

### `ai_product_action_executions`

- Purpose: AI provider/execution state
- Primary key: `product_execution_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `ai_execution_id -> ai_executions.execution_id`, `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `account_id`, `actor_id`, `module_id`, `installation_id`
- Indexes: `ai_product_action_executions_account_idx`, `ai_product_action_executions_ai_execution_id_key`, `ai_product_action_executions_pkey`, `ai_product_action_executions_record_idx`, `ai_product_action_executions_request_id_key`
- Unique constraints: `ai_product_action_executions_ai_execution_id_key(ai_execution_id)`, `ai_product_action_executions_request_id_key(request_id)`
- Soft delete: none
- Timestamps: `expires_at`, `created_at`, `updated_at`, `completed_at`, `applied_at`
- Migration introduced: `026_phase7e_ai_product_actions.sql`
- Routes reading: `POST /v1/modules/:moduleId/ai/actions/:actionId/executions`, `POST /v1/modules/:moduleId/ai/executions/:executionId/apply`
- Routes writing: `POST /v1/modules/:moduleId/ai/actions/:actionId/executions`, `POST /v1/modules/:moduleId/ai/executions/:executionId/apply`
- API/worker source reads: `services/greenfield-api/src/ai/product-action-service.ts`
- API/worker source writes: `services/greenfield-api/src/ai/product-action-service.ts`
- Disposition: active read/write or ledger/schema table

### `ai_product_action_results`

- Purpose: AI provider/execution state
- Primary key: `result_id`
- Foreign keys: `product_execution_id -> ai_product_action_executions.product_execution_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `ai_product_action_results_expiry_idx`, `ai_product_action_results_pkey`, `ai_product_action_results_product_execution_id_key`
- Unique constraints: `ai_product_action_results_product_execution_id_key(product_execution_id)`
- Soft delete: none
- Timestamps: `expires_at`, `created_at`, `applied_at`
- Migration introduced: `026_phase7e_ai_product_actions.sql`
- Routes reading: `POST /v1/modules/:moduleId/ai/actions/:actionId/executions`, `POST /v1/modules/:moduleId/ai/executions/:executionId/apply`
- Routes writing: `POST /v1/modules/:moduleId/ai/actions/:actionId/executions`, `POST /v1/modules/:moduleId/ai/executions/:executionId/apply`
- API/worker source reads: `services/greenfield-api/src/ai/product-action-service.ts`
- API/worker source writes: `services/greenfield-api/src/ai/product-action-service.ts`
- Disposition: active read/write or ledger/schema table

### `ai_provider_credentials`

- Purpose: AI provider/execution state
- Primary key: `credential_id`
- Foreign keys: `provider_id -> greenfield_ai_providers.provider_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `ai_provider_credentials_pkey`, `ai_provider_credentials_scope_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `rotated_at`, `last_verified_at`
- Migration introduced: `025_phase7e_ai_provider_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/ai/runtime-repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/runtime-repository.ts`
- Disposition: active read/write or ledger/schema table

### `ai_provider_health`

- Purpose: AI provider/execution state
- Primary key: `health_id`
- Foreign keys: `model_id -> greenfield_ai_models.model_id`, `provider_id -> greenfield_ai_providers.provider_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `ai_provider_health_pkey`, `ai_provider_health_provider_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `checked_at`
- Migration introduced: `025_phase7e_ai_provider_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/ai/runtime-repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/runtime-repository.ts`
- Disposition: active read/write or ledger/schema table

### `ai_provider_runtime_state`

- Purpose: AI provider/execution state
- Primary key: `state_id`
- Foreign keys: `model_id -> greenfield_ai_models.model_id`, `provider_id -> greenfield_ai_providers.provider_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `ai_provider_runtime_state_circuit_idx`, `ai_provider_runtime_state_pkey`, `ai_provider_runtime_state_provider_id_model_id_key`
- Unique constraints: `ai_provider_runtime_state_provider_id_model_id_key(provider_id,model_id)`
- Soft delete: none
- Timestamps: `rolling_window_started_at`, `circuit_opened_at`, `updated_at`
- Migration introduced: `025_phase7e_ai_provider_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/ai/runtime-repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/runtime-repository.ts`
- Disposition: active read/write or ledger/schema table

### `ai_quota_consumption`

- Purpose: AI provider/execution state
- Primary key: `consumption_id`
- Foreign keys: `limit_id -> ai_usage_limits.limit_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `ai_quota_consumption_limit_id_scope_type_scope_id_provider__key`, `ai_quota_consumption_pkey`, `ai_quota_consumption_scope_idx`
- Unique constraints: `ai_quota_consumption_limit_id_scope_type_scope_id_provider__key(limit_id,scope_type,scope_id,provider_id,model_id,bucket_start,unit)`
- Soft delete: none
- Timestamps: `updated_at`
- Migration introduced: `025_phase7e_ai_provider_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/ai/runtime-repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/runtime-repository.ts`
- Disposition: active read/write or ledger/schema table

### `ai_stream_events`

- Purpose: AI provider/execution state
- Primary key: `event_id`
- Foreign keys: `stream_id -> ai_stream_sessions.stream_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `ai_stream_events_pkey`, `ai_stream_events_replay_idx`, `ai_stream_events_stream_id_sequence_key`
- Unique constraints: `ai_stream_events_stream_id_sequence_key(stream_id,sequence)`
- Soft delete: none
- Timestamps: `created_at`, `expires_at`
- Migration introduced: `025_phase7e_ai_provider_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/ai/runtime-repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/runtime-repository.ts`
- Disposition: active read/write or ledger/schema table

### `ai_stream_sessions`

- Purpose: AI provider/execution state
- Primary key: `stream_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `execution_id -> ai_executions.execution_id`, `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `account_id`, `actor_id`, `module_id`, `installation_id`
- Indexes: `ai_stream_sessions_account_idx`, `ai_stream_sessions_execution_idx`, `ai_stream_sessions_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `expires_at`, `cancellation_requested_at`, `created_at`, `updated_at`, `completed_at`
- Migration introduced: `025_phase7e_ai_provider_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/ai/runtime-repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/runtime-repository.ts`
- Disposition: active read/write or ledger/schema table

### `ai_usage_limits`

- Purpose: AI provider/execution state
- Primary key: `limit_id`
- Foreign keys: `model_id -> greenfield_ai_models.model_id`, `provider_id -> greenfield_ai_providers.provider_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `ai_usage_limits_pkey`, `ai_usage_limits_scope_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `025_phase7e_ai_provider_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/ai/runtime-repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/runtime-repository.ts`
- Disposition: active read/write or ledger/schema table

### `atproto_connections`

- Purpose: AT Protocol bridge state
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `atproto_connections_actor_id_did_key`, `atproto_connections_actor_idx`, `atproto_connections_did_key`, `atproto_connections_pkey`
- Unique constraints: `atproto_connections_actor_id_did_key(actor_id,did)`, `atproto_connections_did_key(did)`
- Soft delete: deleted_at
- Timestamps: `connected_at`, `refreshed_at`, `disconnected_at`, `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `POST /v1/admin/ops/atproto/connections/:connectionId/revoke`, `GET /v1/atproto/connections`, `POST /v1/atproto/connections/:connectionId/disconnect`, `POST /v1/atproto/connections/:connectionId/refresh`, `GET /v1/atproto/connections/:connectionId/status`, `GET /v1/atproto/oauth/callback`
- Routes writing: `POST /v1/admin/ops/atproto/connections/:connectionId/revoke`, `POST /v1/atproto/connections/:connectionId/disconnect`, `GET /v1/atproto/oauth/callback`
- API/worker source reads: `services/greenfield-api/src/bridges/atproto/service.ts`, `services/greenfield-worker/src/bridges/atproto/ingest.ts`, `services/greenfield-worker/src/bridges/atproto/profile.ts`, `services/greenfield-worker/src/bridges/atproto/publish.ts`, `services/greenfield-worker/src/bridges/atproto/session.ts`
- API/worker source writes: `services/greenfield-api/src/bridges/atproto/service.ts`
- Disposition: active read/write or ledger/schema table

### `atproto_dead_letters`

- Purpose: AT Protocol bridge state
- Primary key: `id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `atproto_dead_letters_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `resolved_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `POST /v1/admin/ops/queue/dead-letters/:deadLetterId/retry`
- Routes writing: `POST /v1/admin/ops/queue/dead-letters/:deadLetterId/retry`
- API/worker source reads: `services/greenfield-api/src/app/register-routes.ts`
- API/worker source writes: `services/greenfield-api/src/app/register-routes.ts`
- Disposition: active read/write or ledger/schema table

### `atproto_oauth_sessions`

- Purpose: AT Protocol bridge state
- Primary key: `id`
- Foreign keys: `connection_id -> atproto_connections.id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `atproto_oauth_sessions_connection_id_key`, `atproto_oauth_sessions_pkey`
- Unique constraints: `atproto_oauth_sessions_connection_id_key(connection_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `revoked_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `GET /v1/atproto/oauth/callback`
- Routes writing: `POST /v1/admin/ops/atproto/connections/:connectionId/revoke`, `POST /v1/atproto/connections/:connectionId/disconnect`, `GET /v1/atproto/oauth/callback`
- API/worker source reads: `services/greenfield-api/src/bridges/atproto/service.ts`, `services/greenfield-worker/src/bridges/atproto/session.ts`
- API/worker source writes: `services/greenfield-api/src/bridges/atproto/service.ts`
- Disposition: active read/write or ledger/schema table

### `atproto_oauth_states`

- Purpose: AT Protocol bridge state
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`, `session_id -> sessions.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `atproto_oauth_states_expires_idx`, `atproto_oauth_states_pkey`, `atproto_oauth_states_state_key`
- Unique constraints: `atproto_oauth_states_state_key(state)`
- Soft delete: none
- Timestamps: `created_at`, `expires_at`, `consumed_at`, `updated_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `GET /v1/atproto/oauth/callback`
- Routes writing: `GET /v1/atproto/oauth/callback`, `POST /v1/atproto/oauth/start`
- API/worker source reads: `services/greenfield-api/src/bridges/atproto/service.ts`
- API/worker source writes: `services/greenfield-api/src/bridges/atproto/service.ts`
- Disposition: active read/write or ledger/schema table

### `atproto_publication_preferences`

- Purpose: AT Protocol bridge state
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `atproto_publication_preferences_actor_id_key`, `atproto_publication_preferences_pkey`
- Unique constraints: `atproto_publication_preferences_actor_id_key(actor_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `GET /v1/atproto/preferences`, `PATCH /v1/atproto/preferences`
- Routes writing: `GET /v1/atproto/oauth/callback`, `PATCH /v1/atproto/preferences`
- API/worker source reads: `services/greenfield-api/src/bridges/atproto/service.ts`
- API/worker source writes: `services/greenfield-api/src/bridges/atproto/service.ts`
- Disposition: active read/write or ledger/schema table

### `atproto_publications`

- Purpose: AT Protocol bridge state
- Primary key: `id`
- Foreign keys: `connection_id -> atproto_connections.id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `atproto_publications_connection_id_local_record_type_local__key`, `atproto_publications_pkey`, `atproto_publications_status_idx`
- Unique constraints: `atproto_publications_connection_id_local_record_type_local__key(connection_id,local_record_type,local_record_id,collection)`
- Soft delete: deleted_at
- Timestamps: `published_at`, `deleted_at`, `next_retry_at`, `created_at`, `updated_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-worker/src/bridges/atproto/delete.ts`, `services/greenfield-worker/src/bridges/atproto/update.ts`
- API/worker source writes: `services/greenfield-worker/src/bridges/atproto/delete.ts`, `services/greenfield-worker/src/bridges/atproto/profile.ts`, `services/greenfield-worker/src/bridges/atproto/publish.ts`, `services/greenfield-worker/src/bridges/atproto/update.ts`
- Disposition: active read/write or ledger/schema table

### `atproto_records`

- Purpose: AT Protocol bridge state
- Primary key: `did`, `collection`, `rkey`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `atproto_records_collection_idx`, `atproto_records_pkey`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `indexed_at`, `deleted_at`, `created_at`, `updated_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `GET /v1/atproto/feed`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/bridges/atproto/service.ts`
- API/worker source writes: `services/greenfield-worker/src/bridges/atproto/ingest.ts`
- Disposition: active read/write or ledger/schema table

### `atproto_sync_checkpoints`

- Purpose: AT Protocol bridge state
- Primary key: `source`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `atproto_sync_checkpoints_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `updated_at`, `last_success_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-worker/src/bridges/atproto/ingest.ts`
- API/worker source writes: `services/greenfield-worker/src/bridges/atproto/ingest.ts`
- Disposition: active read/write or ledger/schema table

### `attachment_upload_sessions`

- Purpose: application state for attachment upload sessions
- Primary key: `upload_id`
- Foreign keys: `attachment_id -> attachments.attachment_id`, `owner_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `owner_account_id`
- Indexes: `attachment_upload_sessions_attachment_id_key`, `attachment_upload_sessions_expiry_idx`, `attachment_upload_sessions_pkey`
- Unique constraints: `attachment_upload_sessions_attachment_id_key(attachment_id)`
- Soft delete: none
- Timestamps: `expires_at`, `completed_at`, `created_at`, `updated_at`
- Migration introduced: `057_post04_attachment_platform.sql`
- Routes reading: `PUT /v1/attachments/uploads/:uploadId/content`
- Routes writing: `POST /v1/attachments/uploads`, `PUT /v1/attachments/uploads/:uploadId/content`
- API/worker source reads: `services/greenfield-api/src/domains/attachments/service.ts`, `services/greenfield-worker/src/media/cleanup.ts`
- API/worker source writes: `services/greenfield-api/src/domains/attachments/service.ts`, `services/greenfield-worker/src/media/cleanup.ts`
- Disposition: active read/write or ledger/schema table

### `attachments`

- Purpose: application state for attachments
- Primary key: `attachment_id`
- Foreign keys: `owner_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `owner_account_id`
- Indexes: `attachments_orphan_cleanup_idx`, `attachments_owner_status_idx`, `attachments_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `attached_at`, `created_at`, `updated_at`
- Migration introduced: `057_post04_attachment_platform.sql`
- Routes reading: `DELETE /v1/attachments/:attachmentId`, `GET /v1/attachments/:attachmentId`, `GET /v1/attachments/:attachmentId/content`, `PUT /v1/attachments/uploads/:uploadId/content`, `POST /v1/comments/:commentId/replies`, `POST /v1/communities`, `PATCH /v1/communities/:communityId`, `POST /v1/communities/:communityId/events`, `PATCH /v1/communities/:communityId/events/:eventId`, `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages`, `PATCH /v1/conversations/:id/messages/:messageId`, `DELETE /v1/conversations/:id/messages/:messageId/reactions`, `PUT /v1/conversations/:id/messages/:messageId/reactions`, `GET /v1/discover`, `GET /v1/feed/home`, `GET /v1/feed/profile/:profileId`, `GET /v1/media/:mediaFile`, `POST /v1/modules/:moduleId/records/:collection/:recordId/media`, `POST /v1/posts`, `GET /v1/posts/:postId`, `POST /v1/posts/:postId/comments`, `DELETE /v1/posts/:postId/like`, `POST /v1/posts/:postId/like`, `DELETE /v1/posts/:postId/repost`, `POST /v1/posts/:postId/repost`, `DELETE /v1/posts/:postId/save`, `POST /v1/posts/:postId/save`, `GET /v1/profiles/:handle/posts`, `DELETE /v1/profiles/me/avatar`, `POST /v1/profiles/me/avatar`, `DELETE /v1/profiles/me/cover`, `POST /v1/profiles/me/cover`, `GET /v1/reels`, `POST /v1/stories`, `DELETE /v1/stories/items/:itemId`
- Routes writing: `DELETE /v1/attachments/:attachmentId`, `POST /v1/attachments/uploads`, `PUT /v1/attachments/uploads/:uploadId/content`, `POST /v1/comments/:commentId/replies`, `POST /v1/communities`, `PATCH /v1/communities/:communityId`, `POST /v1/communities/:communityId/events`, `PATCH /v1/communities/:communityId/events/:eventId`, `POST /v1/conversations/:id/messages`, `POST /v1/in-mail/:id/replies`, `POST /v1/modules/:moduleId/records/:collection/:recordId/media`, `POST /v1/posts`, `POST /v1/posts/:postId/comments`, `DELETE /v1/profiles/me/avatar`, `POST /v1/profiles/me/avatar`, `DELETE /v1/profiles/me/cover`, `POST /v1/profiles/me/cover`, `POST /v1/stories`, `DELETE /v1/stories/items/:itemId`
- API/worker source reads: `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/domains/attachments/service.ts`, `services/greenfield-api/src/domains/comments/media.ts`, `services/greenfield-api/src/domains/comments/service.ts`, `services/greenfield-api/src/domains/communities/service.ts`, `services/greenfield-api/src/domains/discovery/repository.ts`, `services/greenfield-api/src/domains/drafts/service.ts`, `services/greenfield-api/src/domains/messaging/service.ts`, `services/greenfield-api/src/domains/posts/repository.ts`, `services/greenfield-api/src/domains/posts/writes.ts`, `services/greenfield-api/src/domains/profiles/writes.ts`, `services/greenfield-api/src/domains/stories/service.ts`, `services/greenfield-api/src/modules/media-binding-service.ts`, `services/greenfield-worker/src/media/cleanup.ts`
- API/worker source writes: `services/greenfield-api/src/domains/attachments/service.ts`, `services/greenfield-api/src/domains/comments/media.ts`, `services/greenfield-api/src/domains/comments/service.ts`, `services/greenfield-api/src/domains/communities/service.ts`, `services/greenfield-api/src/domains/messaging/service.ts`, `services/greenfield-api/src/domains/posts/writes.ts`, `services/greenfield-api/src/domains/profiles/writes.ts`, `services/greenfield-api/src/domains/stories/service.ts`, `services/greenfield-api/src/modules/media-binding-service.ts`, `services/greenfield-worker/src/media/cleanup.ts`
- Disposition: active read/write or ledger/schema table

### `audit_events`

- Purpose: application state for audit events
- Primary key: `id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `actor_id`, `account_id`
- Indexes: `audit_events_account_created_idx`, `audit_events_action_result_idx`, `audit_events_audit_id_uidx`, `audit_events_pkey`, `audit_events_request_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/domains/audit/repository.ts`, `services/greenfield-worker/src/modules/extension-job-handler.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `background_jobs`

- Purpose: application state for background jobs
- Primary key: `id`
- Foreign keys: `owner_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `owner_id`, `owner_account_id`, `product_id`, `installation_id`
- Indexes: `background_jobs_claim_idx`, `background_jobs_lease_idx`, `background_jobs_pkey`, `background_jobs_scope_idx`, `background_jobs_service_idempotency_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `available_at`, `lease_expires_at`, `maximum_attempts`, `created_at`, `updated_at`, `completed_at`, `started_at`, `finished_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `POST /v1/backend/products/:productId/jobs`, `POST /v1/backend/products/:productId/jobs/:jobId/cancel`, `POST /v1/backend/products/:productId/jobs/:jobId/fail`, `GET /v1/backend/products/:productId/jobs/:jobId/result`, `POST /v1/backend/products/:productId/jobs/:jobId/start`, `POST /v1/backend/products/:productId/jobs/:jobId/succeed`, `POST /v1/backend/products/:productId/jobs/claim`
- Routes writing: `POST /v1/accounts/me/modula-mail/forwarding`, `POST /v1/accounts/me/modula-mail/provision`, `POST /v1/admin/ops/queue/dead-letters/:deadLetterId/retry`, `POST /v1/backend/products/:productId/jobs`, `POST /v1/backend/products/:productId/jobs/:jobId/cancel`, `POST /v1/backend/products/:productId/jobs/:jobId/fail`, `POST /v1/backend/products/:productId/jobs/:jobId/start`, `POST /v1/backend/products/:productId/jobs/:jobId/succeed`, `POST /v1/backend/products/:productId/jobs/claim`
- API/worker source reads: `services/greenfield-api/src/backend-fabric/event-job-service.ts`, `services/greenfield-api/src/domains/notifications/reaction-dead-letter-retry.ts`, `services/greenfield-api/src/domains/system/status.ts`, `services/greenfield-api/src/publisher/release-job-runner.ts`, `services/greenfield-worker/src/jobs/claim.ts`, `services/greenfield-worker/src/outbox/drain.ts`
- API/worker source writes: `services/greenfield-api/src/app/register-routes.ts`, `services/greenfield-api/src/backend-fabric/event-job-service.ts`, `services/greenfield-api/src/domains/notifications/reaction-dead-letter-retry.ts`, `services/greenfield-api/src/domains/outbox/repository.ts`, `services/greenfield-api/src/domains/search/repository.ts`, `services/greenfield-api/src/mail/identity-service.ts`, `services/greenfield-api/src/mail/service.ts`, `services/greenfield-api/src/publisher/release-job-core.ts`, `services/greenfield-api/src/publisher/release-job-runner.ts`, `services/greenfield-worker/src/digests/digests.ts`, `services/greenfield-worker/src/events/runner.ts`, `services/greenfield-worker/src/jobs/claim.ts`, `services/greenfield-worker/src/modules/extension-event-handler.ts`, `services/greenfield-worker/src/outbox/drain.ts`
- Disposition: active read/write or ledger/schema table

### `blocks`

- Purpose: application state for blocks
- Primary key: `id`
- Foreign keys: `blocked_actor_id -> actors.id`, `blocker_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `blocker_actor_id`, `blocked_actor_id`
- Indexes: `blocks_blocked_idx`, `blocks_blocker_actor_id_blocked_actor_id_key`, `blocks_blocker_idx`, `blocks_pkey`
- Unique constraints: `blocks_blocker_actor_id_blocked_actor_id_key(blocker_actor_id,blocked_actor_id)`
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `GET /v1/accounts/me/blocks`, `POST /v1/admin/ops/policy/evaluate`, `GET /v1/attachments/:attachmentId/content`, `POST /v1/auth/preview/session`, `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `POST /v1/calls/:callId/media-credentials`, `GET /v1/calls/:callId/signalling`, `POST /v1/calls/:callId/signalling-ticket`, `GET /v1/comments/:commentId/replies`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `GET /v1/conversations`, `POST /v1/conversations`, `POST /v1/conversations/:id/calls`, `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages`, `GET /v1/conversations/:id/messages/:messageId/reactions`, `GET /v1/conversations/:id/messages/:messageId/receipts`, `POST /v1/conversations/:id/read`, `GET /v1/conversations/:id/typing`, `GET /v1/conversations/unread`, `GET /v1/feed/home`, `POST /v1/groups`, `GET /v1/groups/:id`, `PATCH /v1/groups/:id`, `POST /v1/groups/:id/members`, `DELETE /v1/groups/:id/members/:actorId`, `POST /v1/groups/:id/members/:actorId/role`, `GET /v1/in-mail`, `POST /v1/in-mail`, `POST /v1/in-mail/:id/replies`, `GET /v1/media/stories/:mediaFile`, `POST /v1/message-requests/:id/accept`, `GET /v1/messages/search`, `GET /v1/messaging/socket`, `GET /v1/notifications`, `GET /v1/posts/:postId/comments`, `GET /v1/presence`, `GET /v1/profiles/:handle`, `GET /v1/profiles/:handle/followers`, `GET /v1/profiles/:handle/following`, `POST /v1/profiles/:profileId/block`, `DELETE /v1/profiles/:profileId/follow`, `POST /v1/profiles/:profileId/follow`, `PATCH /v1/profiles/me`, `POST /v1/stories`, `GET /v1/stories/:groupId`, `POST /v1/stories/:storyId/replies`, `POST /v1/stories/items/:itemId/viewed`, `GET /v1/stories/rail`
- Routes writing: `DELETE /v1/profiles/:profileId/block`, `POST /v1/profiles/:profileId/block`
- API/worker source reads: `services/greenfield-api/src/domains/calls/service.ts`, `services/greenfield-api/src/domains/comments/service.ts`, `services/greenfield-api/src/domains/messaging/service.ts`, `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/notifications/repository.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/domains/profiles/repository.ts`, `services/greenfield-api/src/domains/profiles/writes.ts`, `services/greenfield-api/src/domains/search/repository.ts`, `services/greenfield-api/src/domains/stories/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`, `services/greenfield-worker/src/notifications/create.ts`, `services/greenfield-worker/src/notifications/social.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moderation/repository.ts`
- Disposition: active read/write or ledger/schema table

### `featured_modules`

- Purpose: application state for featured modules
- Primary key: `id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `featured_modules_pkey`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `GET /v1/discover`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/discovery/repository.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `follow_requests`

- Purpose: application state for follow requests
- Primary key: `request_id`
- Foreign keys: `requester_actor_id -> actors.id`, `target_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `requester_actor_id`, `target_actor_id`
- Indexes: `follow_requests_pkey`, `follow_requests_requester_actor_id_target_actor_id_key`, `follow_requests_requester_pending_idx`, `follow_requests_target_pending_idx`
- Unique constraints: `follow_requests_requester_actor_id_target_actor_id_key(requester_actor_id,target_actor_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `resolved_at`
- Migration introduced: `066_trust_privacy_fail_closed.sql`
- Routes reading: `POST /v1/profiles/:profileId/follow`, `GET /v1/profiles/me/follow-requests`
- Routes writing: `DELETE /v1/follow-requests/:requestId`, `POST /v1/follow-requests/:requestId/accept`, `POST /v1/follow-requests/:requestId/reject`, `POST /v1/profiles/:profileId/block`, `DELETE /v1/profiles/:profileId/follow`, `POST /v1/profiles/:profileId/follow`
- API/worker source reads: `services/greenfield-api/src/domains/profiles/writes.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/profiles/writes.ts`
- Disposition: active read/write or ledger/schema table

### `follows`

- Purpose: application state for follows
- Primary key: `id`
- Foreign keys: `followed_actor_id -> actors.id`, `follower_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `follower_actor_id`, `followed_actor_id`
- Indexes: `follows_follower_actor_id_followed_actor_id_key`, `follows_pkey`
- Unique constraints: `follows_follower_actor_id_followed_actor_id_key(follower_actor_id,followed_actor_id)`
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `POST /v1/admin/ops/policy/evaluate`, `GET /v1/attachments/:attachmentId/content`, `POST /v1/auth/preview/session`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `POST /v1/conversations`, `GET /v1/creator/insights`, `GET /v1/feed/home`, `POST /v1/groups`, `POST /v1/groups/:id/members`, `GET /v1/media/stories/:mediaFile`, `GET /v1/profiles/:handle`, `GET /v1/profiles/:handle/followers`, `GET /v1/profiles/:handle/following`, `DELETE /v1/profiles/:profileId/follow`, `POST /v1/profiles/:profileId/follow`, `PATCH /v1/profiles/me`, `POST /v1/stories`, `GET /v1/stories/:groupId`, `POST /v1/stories/:storyId/replies`, `POST /v1/stories/items/:itemId/viewed`, `GET /v1/stories/rail`
- Routes writing: `POST /v1/profiles/:profileId/block`, `DELETE /v1/profiles/:profileId/follow`
- API/worker source reads: `services/greenfield-api/src/domains/messaging/service.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/domains/posts/repository.ts`, `services/greenfield-api/src/domains/profiles/repository.ts`, `services/greenfield-api/src/domains/profiles/writes.ts`, `services/greenfield-api/src/domains/search/repository.ts`, `services/greenfield-api/src/domains/stories/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`, `services/greenfield-worker/src/digests/digests.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/profiles/writes.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_account_app_preferences`

- Purpose: application state for greenfield account app preferences
- Primary key: `account_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_account_app_preferences_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `updated_at`
- Migration introduced: `063_settings_backend_v2.sql`
- Routes reading: `GET /v1/accounts/me/app-preferences`, `PATCH /v1/accounts/me/app-preferences`
- Routes writing: `PATCH /v1/accounts/me/app-preferences`
- API/worker source reads: `services/greenfield-api/src/settings-v2/service.ts`, `services/greenfield-worker/src/digests/digests.ts`
- API/worker source writes: `services/greenfield-api/src/settings-v2/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_account_data_artifacts`

- Purpose: application state for greenfield account data artifacts
- Primary key: `artifact_id`
- Foreign keys: `data_request_domain_id -> greenfield_account_data_request_domains.data_request_domain_id`, `data_request_id -> greenfield_account_data_requests.data_request_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_account_data_artifacts_data_request_domain_id_key`, `greenfield_account_data_artifacts_pkey`
- Unique constraints: `greenfield_account_data_artifacts_data_request_domain_id_key(data_request_domain_id)`
- Soft delete: none
- Timestamps: `created_at`, `expires_at`
- Migration introduced: `050_greenfield_backend_v1_account_data_orchestration.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `GET /v1/account/data-requests/:requestId/artifacts`, `POST /v1/backend/products/:productId/data-request-domains/:domainId/complete`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/backend/products/:productId/data-request-domains/:domainId/complete`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_account_data_request_domains`

- Purpose: application state for greenfield account data request domains
- Primary key: `data_request_domain_id`
- Foreign keys: `data_request_id -> greenfield_account_data_requests.data_request_id`, `installation_id -> greenfield_extension_installations.installation_id`, `resource_id -> greenfield_data_resources.resource_id`
- Ownership/workspace/user/module columns: `product_id`, `installation_id`
- Indexes: `greenfield_account_data_domains_claim_idx`, `greenfield_account_data_request__data_request_id_domain_key_key`, `greenfield_account_data_request_domains_pkey`
- Unique constraints: `greenfield_account_data_request__data_request_id_domain_key_key(data_request_id,domain_key)`
- Soft delete: none
- Timestamps: `claim_expires_at`, `created_at`, `updated_at`, `completed_at`
- Migration introduced: `050_greenfield_backend_v1_account_data_orchestration.sql`
- Routes reading: `GET /v1/account/data-requests/:requestId`, `POST /v1/account/data-requests/:requestId/advance`, `GET /v1/account/data-requests/:requestId/artifacts`, `POST /v1/account/data-requests/:requestId/cancel`, `POST /v1/backend/products/:productId/data-request-domains/:domainId/complete`, `POST /v1/backend/products/:productId/data-requests/claim`
- Routes writing: `POST /v1/account/data-exports`, `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/account/deletion-requests`, `POST /v1/backend/products/:productId/data-request-domains/:domainId/complete`, `POST /v1/backend/products/:productId/data-requests/claim`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_account_data_requests`

- Purpose: application state for greenfield account data requests
- Primary key: `data_request_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `requested_by_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `requested_by_account_id`
- Indexes: `greenfield_account_data_reque_account_id_request_type_idemp_key`, `greenfield_account_data_requests_account_idx`, `greenfield_account_data_requests_pkey`
- Unique constraints: `greenfield_account_data_reque_account_id_request_type_idemp_key(account_id,request_type,idempotency_key)`
- Soft delete: none
- Timestamps: `expires_at`, `created_at`, `updated_at`, `completed_at`, `cancelled_at`
- Migration introduced: `050_greenfield_backend_v1_account_data_orchestration.sql`
- Routes reading: `POST /v1/account/data-exports`, `GET /v1/account/data-requests/:requestId`, `POST /v1/account/data-requests/:requestId/advance`, `GET /v1/account/data-requests/:requestId/artifacts`, `POST /v1/account/data-requests/:requestId/cancel`, `POST /v1/account/deletion-requests`, `GET /v1/account/deletion-requests/current`, `POST /v1/backend/products/:productId/data-request-domains/:domainId/complete`, `POST /v1/backend/products/:productId/data-requests/claim`
- Routes writing: `POST /v1/account/data-exports`, `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/account/data-requests/:requestId/cancel`, `POST /v1/account/deletion-requests`, `POST /v1/backend/products/:productId/data-request-domains/:domainId/complete`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_account_default_providers`

- Purpose: application state for greenfield account default providers
- Primary key: `account_id`, `capability_role`
- Foreign keys: `provider_installation_id -> greenfield_extension_installations.installation_id`, `selected_by_account_id -> greenfield_accounts.account_id`, `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `provider_product_id`, `provider_installation_id`, `selected_by_account_id`
- Indexes: `greenfield_account_default_providers_pkey`, `greenfield_account_default_providers_product_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `selected_at`, `updated_at`
- Migration introduced: `051_greenfield_backend_v1_default_providers.sql`
- Routes reading: `GET /v1/providers/:capabilityRole`, `PUT /v1/providers/:capabilityRole/default`, `GET /v1/providers/:capabilityRole/resolve`
- Routes writing: `PUT /v1/providers/:capabilityRole/default`
- API/worker source reads: `services/greenfield-api/src/providers/service.ts`
- API/worker source writes: `services/greenfield-api/src/providers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_account_deletion_tombstones`

- Purpose: application state for greenfield account deletion tombstones
- Primary key: `account_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `data_request_id -> greenfield_account_data_requests.data_request_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_account_deletion_tombstones_data_request_id_key`, `greenfield_account_deletion_tombstones_pkey`
- Unique constraints: `greenfield_account_deletion_tombstones_data_request_id_key(data_request_id)`
- Soft delete: none
- Timestamps: `completed_at`
- Migration introduced: `050_greenfield_backend_v1_account_data_orchestration.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_accounts`

- Purpose: application state for greenfield accounts
- Primary key: `account_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_accounts_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/account/data-exports`, `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/account/deletion-requests`, `POST /v1/accounts/forgot-password`, `GET /v1/accounts/me`, `PATCH /v1/accounts/me`, `POST /v1/accounts/me/handle`, `POST /v1/accounts/me/modula-mail/provision`, `POST /v1/accounts/me/password`, `POST /v1/accounts/recovery/complete`, `POST /v1/accounts/recovery/request`, `POST /v1/accounts/resend-verification`, `POST /v1/accounts/reset-password`, `POST /v1/accounts/verify-email`, `POST /v1/admin/commerce/entitlements`, `PUT /v1/admin/developer/build-services/:serviceId`, `POST /v1/admin/developer/namespaces/:namespace/verify`, `PATCH /v1/admin/developer/programme/:accountId`, `POST /v1/admin/gubic/games/:gameId/review`, `GET /v1/admin/gubic/submissions`, `POST /v1/admin/gubic/submissions/:submissionId/decision`, `POST /v1/admin/product-standard/ingest`, `PUT /v1/admin/qa/premium/:handle`, `GET /v1/admin/qa/verification/applications`, `GET /v1/admin/registry/artifacts/orphans`, `POST /v1/admin/registry/modules/import`, `POST /v1/admin/registry/publishers/:publisherId/signing-keys`, `POST /v1/admin/registry/publishers/:publisherId/signing-keys/:keyId/revoke`, `POST /v1/admin/registry/releases/:releaseId/signature`, `POST /v1/admin/registry/sync`, `GET /v1/admin/registry/sync-runs`, `POST /v1/auth/passkeys/registration/options`, `POST /v1/auth/totp/enroll`, `GET /v1/backend/products/:productId/accounts/:accountId`, `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `GET /v1/calls/:callId/signalling`, `POST /v1/conversations`, `POST /v1/conversations/:id/calls`, `POST /v1/developer/organisations/:organisationId/members`, `POST /v1/groups`, `POST /v1/groups/:id/members`, `GET /v1/gubic/games/:gameId/lobbies`, `POST /v1/gubic/games/:gameId/lobbies`, `GET /v1/gubic/lobbies/:lobbyId`, `POST /v1/gubic/lobbies/:lobbyId/join`, `POST /v1/gubic/lobbies/:lobbyId/ready`, `POST /v1/gubic/lobbies/:lobbyId/start`, `POST /v1/gubic/lobbies/join`, `POST /v1/in-mail`, `PUT /v1/me/moliboos/outfit`, `POST /v1/modules/:moduleId/records/:collection/:recordId/shares`, `PATCH /v1/profiles/me`, `POST /v1/sessions`, `POST /v1/sessions/apple`, `POST /v1/sessions/email-code`, `POST /v1/sessions/email-code/request`, `POST /v1/sessions/passkey/options`, `POST /v1/sessions/recovery-code`, `POST /v1/support/cases`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/accounts/me/handle`, `POST /v1/accounts/register`, `POST /v1/accounts/verify-email`, `PATCH /v1/profiles/me`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/accounts/recovery.ts`, `services/greenfield-api/src/accounts/service.ts`, `services/greenfield-api/src/app/register-routes.ts`, `services/greenfield-api/src/auth/apple/service.ts`, `services/greenfield-api/src/auth/mfa/totp.ts`, `services/greenfield-api/src/auth/passkeys/service.ts`, `services/greenfield-api/src/authentication/service.ts`, `services/greenfield-api/src/backend-fabric/routes.ts`, `services/greenfield-api/src/cli/api-atlas-identities.ts`, `services/greenfield-api/src/developers/service.ts`, `services/greenfield-api/src/domains/calls/service.ts`, `services/greenfield-api/src/domains/messaging/service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`, `services/greenfield-api/src/entitlements/routes.ts`, `services/greenfield-api/src/entitlements/service.ts`, `services/greenfield-api/src/gubic/play-service.ts`, `services/greenfield-api/src/mail/identity-service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`, `services/greenfield-api/src/modules/permission-service.ts`, `services/greenfield-api/src/modules/publisher-service.ts`, `services/greenfield-api/src/modules/record-sharing-service.ts`, `services/greenfield-api/src/premium/service.ts`, `services/greenfield-api/src/premium/verification-service.ts`, `services/greenfield-api/src/support/service.ts`, `services/greenfield-worker/src/digests/digests.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/accounts/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_actor_presence`

- Purpose: application state for greenfield actor presence
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `089_messaging_v3.sql`
- Routes reading: `GET /v1/presence`
- Routes writing: `GET /v1/messaging/socket`, `POST /v1/presence/heartbeat`
- API/worker source reads: `services/greenfield-api/src/domains/messaging/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/messaging/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_ai_models`

- Purpose: application state for greenfield ai models
- Primary key: `model_id`
- Foreign keys: `provider_id -> greenfield_ai_providers.provider_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_ai_models_enabled_idx`, `greenfield_ai_models_pkey`, `greenfield_ai_models_provider_id_provider_model_id_key`
- Unique constraints: `greenfield_ai_models_provider_id_provider_model_id_key(provider_id,provider_model_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `024_phase7e_ai_platform_foundation.sql`
- Routes reading: `POST /v1/admin/ai/models`, `GET /v1/ai/models`
- Routes writing: `POST /v1/admin/ai/models`
- API/worker source reads: `services/greenfield-api/src/ai/repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/repository.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_ai_prompts`

- Purpose: application state for greenfield ai prompts
- Primary key: `prompt_id`, `version`
- Foreign keys: none
- Ownership/workspace/user/module columns: `module_id`
- Indexes: `greenfield_ai_prompts_module_idx`, `greenfield_ai_prompts_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `024_phase7e_ai_platform_foundation.sql`
- Routes reading: `POST /v1/admin/ai/prompts`
- Routes writing: `POST /v1/admin/ai/prompts`
- API/worker source reads: `services/greenfield-api/src/ai/repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/repository.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_ai_providers`

- Purpose: application state for greenfield ai providers
- Primary key: `provider_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_ai_providers_kind_status_idx`, `greenfield_ai_providers_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `024_phase7e_ai_platform_foundation.sql`
- Routes reading: `POST /v1/admin/ai/models`, `POST /v1/admin/ai/providers`, `GET /v1/admin/ops/ai/providers`, `GET /v1/ai/providers`
- Routes writing: `POST /v1/admin/ai/providers`
- API/worker source reads: `services/greenfield-api/src/ai/repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/repository.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_ai_request_ledger`

- Purpose: application state for greenfield ai request ledger
- Primary key: `request_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `model_id -> greenfield_ai_models.model_id`, `provider_id -> greenfield_ai_providers.provider_id`
- Ownership/workspace/user/module columns: `requesting_module_id`, `account_id`, `actor_id`, `installation_id`
- Indexes: `greenfield_ai_request_ledger_account_idx`, `greenfield_ai_request_ledger_correlation_idx`, `greenfield_ai_request_ledger_module_idx`, `greenfield_ai_request_ledger_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `started_at`, `completed_at`, `created_at`, `updated_at`
- Migration introduced: `024_phase7e_ai_platform_foundation.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/ai/gateway-service.ts`
- API/worker source writes: `services/greenfield-api/src/ai/repository.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_ai_streams`

- Purpose: application state for greenfield ai streams
- Primary key: `stream_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `request_id -> greenfield_ai_request_ledger.request_id`
- Ownership/workspace/user/module columns: `account_id`, `actor_id`, `module_id`
- Indexes: `greenfield_ai_streams_pkey`, `greenfield_ai_streams_request_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `cancellation_requested_at`, `reconnect_expires_at`, `created_at`, `updated_at`, `completed_at`
- Migration introduced: `024_phase7e_ai_platform_foundation.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/ai/repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/repository.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_ai_tool_declarations`

- Purpose: application state for greenfield ai tool declarations
- Primary key: `tool_id`
- Foreign keys: `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `module_id`, `installation_id`
- Indexes: `greenfield_ai_tool_declarations_module_idx`, `greenfield_ai_tool_declarations_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `024_phase7e_ai_platform_foundation.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/ai/repository.ts`
- API/worker source writes: `services/greenfield-api/src/ai/repository.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_ai_tool_runs`

- Purpose: application state for greenfield ai tool runs
- Primary key: `tool_run_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `request_id -> greenfield_ai_request_ledger.request_id`, `tool_id -> greenfield_ai_tool_declarations.tool_id`
- Ownership/workspace/user/module columns: `module_id`, `installation_id`, `account_id`, `actor_id`
- Indexes: `greenfield_ai_tool_runs_pkey`, `greenfield_ai_tool_runs_request_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `completed_at`
- Migration introduced: `024_phase7e_ai_platform_foundation.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/ai/repository.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_appearance_preferences`

- Purpose: application state for greenfield appearance preferences
- Primary key: `account_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_appearance_preferences_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `updated_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: `GET /v1/accounts/me/appearance`, `PATCH /v1/accounts/me/appearance`
- Routes writing: `GET /v1/accounts/me/appearance`, `PATCH /v1/accounts/me/appearance`
- API/worker source reads: `services/greenfield-api/src/domains/appearance/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/appearance/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_auth_challenge_attempts`

- Purpose: application state for greenfield auth challenge attempts
- Primary key: `attempt_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `challenge_id -> greenfield_auth_challenges.challenge_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_auth_challenge_attempts_account_idx`, `greenfield_auth_challenge_attempts_challenge_idx`, `greenfield_auth_challenge_attempts_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `031_phase7i_f5_auth_domain.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/auth/challenges/service.ts`, `services/greenfield-api/src/auth/mfa/totp.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_auth_challenges`

- Purpose: application state for greenfield auth challenges
- Primary key: `challenge_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `method_id -> greenfield_authentication_methods.method_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_auth_challenges_account_idx`, `greenfield_auth_challenges_challenge_hash_key`, `greenfield_auth_challenges_pkey`, `greenfield_auth_challenges_rate_limit_idx`, `greenfield_auth_challenges_subject_idx`, `greenfield_auth_challenges_target_hash_idx`
- Unique constraints: `greenfield_auth_challenges_challenge_hash_key(challenge_hash)`
- Soft delete: none
- Timestamps: `expires_at`, `verified_at`, `consumed_at`, `superseded_at`, `last_attempt_at`, `created_at`
- Migration introduced: `031_phase7i_f5_auth_domain.sql`
- Routes reading: `POST /v1/auth/passkeys/registration/verify`, `POST /v1/auth/totp/verify`, `POST /v1/sessions/passkey`
- Routes writing: `POST /v1/auth/totp/verify`
- API/worker source reads: `services/greenfield-api/src/auth/challenges/service.ts`, `services/greenfield-api/src/auth/mfa/totp.ts`, `services/greenfield-api/src/auth/passkeys/service.ts`
- API/worker source writes: `services/greenfield-api/src/auth/challenges/service.ts`, `services/greenfield-api/src/auth/mfa/totp.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_auth_identities`

- Purpose: application state for greenfield auth identities
- Primary key: `identity_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_auth_identities_kind_identifier_key`, `greenfield_auth_identities_pkey`
- Unique constraints: `greenfield_auth_identities_kind_identifier_key(kind,identifier)`
- Soft delete: none
- Timestamps: `verified_at`, `created_at`, `updated_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/accounts/forgot-password`, `GET /v1/accounts/me`, `PATCH /v1/accounts/me`, `GET /v1/accounts/me/app-preferences`, `PATCH /v1/accounts/me/app-preferences`, `POST /v1/accounts/me/modula-mail/provision`, `POST /v1/accounts/me/password`, `POST /v1/accounts/recovery/complete`, `POST /v1/accounts/recovery/request`, `POST /v1/accounts/register`, `POST /v1/accounts/resend-verification`, `POST /v1/accounts/reset-password`, `POST /v1/accounts/verify-email`, `POST /v1/auth/passkeys/registration/options`, `POST /v1/sessions`, `POST /v1/sessions/email-code`, `POST /v1/sessions/email-code/request`, `POST /v1/sessions/passkey/options`, `POST /v1/sessions/recovery-code`, `POST /v1/support/cases`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/accounts/register`, `POST /v1/accounts/verify-email`, `POST /v1/auth/passkeys/registration/verify`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/accounts/recovery.ts`, `services/greenfield-api/src/accounts/service.ts`, `services/greenfield-api/src/app/register-routes.ts`, `services/greenfield-api/src/auth/passkeys/service.ts`, `services/greenfield-api/src/authentication/service.ts`, `services/greenfield-api/src/cli/api-atlas-identities.ts`, `services/greenfield-api/src/mail/identity-service.ts`, `services/greenfield-api/src/settings-v2/service.ts`, `services/greenfield-api/src/support/service.ts`, `services/greenfield-worker/src/digests/digests.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/accounts/service.ts`, `services/greenfield-api/src/auth/passkeys/service.ts`, `services/greenfield-api/src/cli/api-atlas-identities.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_auth_rate_limits`

- Purpose: application state for greenfield auth rate limits
- Primary key: `rate_limit_key`, `purpose`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_auth_rate_limits_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `window_started_at`, `updated_at`
- Migration introduced: `031_phase7i_f5_auth_domain.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/auth/challenges/service.ts`
- API/worker source writes: `services/greenfield-api/src/auth/challenges/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_authentication_methods`

- Purpose: application state for greenfield authentication methods
- Primary key: `method_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_auth_methods_account_idx`, `greenfield_auth_methods_apple_active_unique`, `greenfield_auth_methods_email_otp_active_unique`, `greenfield_auth_methods_password_active_unique`, `greenfield_auth_methods_recovery_active_unique`, `greenfield_auth_methods_totp_active_unique`, `greenfield_auth_methods_totp_pending_unique`, `greenfield_auth_methods_type_idx`, `greenfield_authentication_methods_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `verified_at`, `last_used_at`, `created_at`, `updated_at`, `revoked_at`
- Migration introduced: `031_phase7i_f5_auth_domain.sql`
- Routes reading: `POST /v1/auth/apple/link`, `POST /v1/auth/step-up/password`, `POST /v1/sessions/apple`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/auth/apple/link`, `DELETE /v1/auth/passkeys/:passkeyId`, `POST /v1/auth/step-up/password`, `POST /v1/auth/totp/disable`, `POST /v1/auth/totp/enroll`, `POST /v1/auth/totp/verify`
- API/worker source reads: `services/greenfield-api/src/auth/apple/service.ts`, `services/greenfield-api/src/auth/credentials/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/auth/apple/service.ts`, `services/greenfield-api/src/auth/credentials/service.ts`, `services/greenfield-api/src/auth/mfa/totp.ts`, `services/greenfield-api/src/auth/passkeys/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_backup_acl_reconciliation`

- Purpose: application state for greenfield backup acl reconciliation
- Primary key: `object_identity`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_backup_acl_reconciliation_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `reconciled_at`
- Migration introduced: `053_greenfield_backend_v1_backup_acl_reconciliation.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `greenfield_backup_sequence_acl_reconciliation`

- Purpose: application state for greenfield backup sequence acl reconciliation
- Primary key: `record_identity`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_backup_sequence_acl_reconciliation_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `reconciled_at`
- Migration introduced: `073_backup_sequence_acl_defaults.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `greenfield_billing_adapter_registrations`

- Purpose: application state for greenfield billing adapter registrations
- Primary key: `adapter`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_billing_adapter_registrations_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `last_verified_at`, `updated_at`
- Migration introduced: `049_greenfield_backend_v1_entitlements_usage.sql`
- Routes reading: `GET /v1/commerce/billing-adapters`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/entitlements/service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/apple-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_board_layouts`

- Purpose: application state for greenfield board layouts
- Primary key: `account_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_board_layouts_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `updated_at`
- Migration introduced: `012_phase7c_board_layout.sql`
- Routes reading: `GET /v1/board/layout`, `PATCH /v1/board/layout`
- Routes writing: `GET /v1/board/layout`, `PATCH /v1/board/layout`
- API/worker source reads: `services/greenfield-api/src/domains/board/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/board/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_bridges`

- Purpose: application state for greenfield bridges
- Primary key: `bridge_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_bridges_pkey`, `greenfield_bridges_slug_key`
- Unique constraints: `greenfield_bridges_slug_key(slug)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/tools/seed.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_build_claim_requests`

- Purpose: application state for greenfield build claim requests
- Primary key: `service_id`, `request_id`
- Foreign keys: `service_id -> greenfield_build_service_registrations.service_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_build_claim_requests_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `claimed_at`
- Migration introduced: `048_greenfield_backend_v1_build_release_pipeline.sql`
- Routes reading: `POST /v1/internal/build-service/claims`
- Routes writing: `POST /v1/internal/build-service/claims`
- API/worker source reads: `services/greenfield-api/src/developers/build-coordinator.ts`
- API/worker source writes: `services/greenfield-api/src/developers/build-coordinator.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_build_provenance`

- Purpose: application state for greenfield build provenance
- Primary key: `build_id`
- Foreign keys: `build_id -> greenfield_developer_builds.build_id`, `service_id -> greenfield_build_service_registrations.service_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_build_provenance_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `verified_at`, `created_at`
- Migration introduced: `048_greenfield_backend_v1_build_release_pipeline.sql`
- Routes reading: `POST /v1/developer/products/:productId/releases`
- Routes writing: `POST /v1/internal/build-service/builds/:buildId/result`
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`
- API/worker source writes: `services/greenfield-api/src/developers/build-coordinator.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_build_result_receipts`

- Purpose: application state for greenfield build result receipts
- Primary key: `receipt_id`
- Foreign keys: `build_id -> greenfield_developer_builds.build_id`, `service_id -> greenfield_build_service_registrations.service_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_build_result_receipts_build_id_payload_sha256_key`, `greenfield_build_result_receipts_pkey`
- Unique constraints: `greenfield_build_result_receipts_build_id_payload_sha256_key(build_id,payload_sha256)`
- Soft delete: none
- Timestamps: `received_at`
- Migration introduced: `048_greenfield_backend_v1_build_release_pipeline.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/internal/build-service/builds/:buildId/result`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/developers/build-coordinator.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_build_service_registrations`

- Purpose: application state for greenfield build service registrations
- Primary key: `service_id`
- Foreign keys: `registered_by_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `registered_by_account_id`
- Indexes: `greenfield_build_service_registrations_pkey`, `greenfield_build_service_registrations_signing_key_id_key`
- Unique constraints: `greenfield_build_service_registrations_signing_key_id_key(signing_key_id)`
- Soft delete: none
- Timestamps: `registered_at`, `updated_at`, `last_health_at`
- Migration introduced: `048_greenfield_backend_v1_build_release_pipeline.sql`
- Routes reading: `POST /v1/internal/build-service/builds/:buildId/result`
- Routes writing: `PUT /v1/admin/developer/build-services/:serviceId`
- API/worker source reads: `services/greenfield-api/src/developers/build-coordinator.ts`
- API/worker source writes: `services/greenfield-api/src/developers/build-coordinator.ts`, `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_call_device_invitations`

- Purpose: application state for greenfield call device invitations
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `090_calls_v1.sql`
- Routes reading: none observed
- Routes writing: `GET /v1/calls/:callId`, `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `GET /v1/calls/:callId/signalling`, `POST /v1/conversations/:id/calls`
- API/worker source reads: `services/greenfield-worker/src/push/voip.ts`
- API/worker source writes: `services/greenfield-api/src/domains/calls/service.ts`, `services/greenfield-worker/src/push/voip.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_call_events`

- Purpose: application state for greenfield call events
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `090_calls_v1.sql`
- Routes reading: `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `GET /v1/calls/:callId/signalling`
- Routes writing: `GET /v1/calls/:callId`, `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `GET /v1/calls/:callId/signalling`, `POST /v1/conversations/:id/calls`
- API/worker source reads: `services/greenfield-api/src/domains/calls/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/calls/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_call_participants`

- Purpose: application state for greenfield call participants
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `090_calls_v1.sql`
- Routes reading: `POST /v1/calls/:callId/media-credentials`, `GET /v1/calls/:callId/signalling`, `POST /v1/conversations/:id/calls`
- Routes writing: `GET /v1/calls/:callId`, `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `POST /v1/calls/:callId/media-credentials`, `GET /v1/calls/:callId/signalling`, `POST /v1/conversations/:id/calls`
- API/worker source reads: `services/greenfield-api/src/domains/calls/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/calls/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_call_push_tokens`

- Purpose: application state for greenfield call push tokens
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `090_calls_v1.sql`
- Routes reading: `POST /v1/conversations/:id/calls`, `GET /v1/push/voip-devices`, `POST /v1/push/voip-devices`
- Routes writing: `POST /v1/push/voip-devices`, `DELETE /v1/push/voip-devices/:registrationId`
- API/worker source reads: `services/greenfield-api/src/domains/calls/service.ts`, `services/greenfield-worker/src/push/voip.ts`
- API/worker source writes: `services/greenfield-api/src/domains/calls/service.ts`, `services/greenfield-worker/src/push/voip.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_call_settings`

- Purpose: application state for greenfield call settings
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `090_calls_v1.sql`
- Routes reading: `POST /v1/calls/:callId/media-credentials`, `POST /v1/conversations/:id/calls`, `GET /v1/me/call-settings`, `PATCH /v1/me/call-settings`
- Routes writing: `PATCH /v1/me/call-settings`
- API/worker source reads: `services/greenfield-api/src/domains/calls/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/calls/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_call_signalling_tickets`

- Purpose: application state for greenfield call signalling tickets
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `090_calls_v1.sql`
- Routes reading: none observed
- Routes writing: `GET /v1/calls/:callId`, `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `GET /v1/calls/:callId/signalling`, `POST /v1/calls/:callId/signalling-ticket`, `POST /v1/conversations/:id/calls`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/domains/calls/service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_calls`

- Purpose: application state for greenfield calls
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `090_calls_v1.sql`
- Routes reading: `GET /v1/calls/:callId`, `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `POST /v1/calls/:callId/media-credentials`, `GET /v1/calls/:callId/signalling`, `POST /v1/calls/:callId/signalling-ticket`, `POST /v1/conversations/:id/calls`, `GET /v1/me/calls`
- Routes writing: `GET /v1/calls/:callId`, `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `GET /v1/calls/:callId/signalling`, `POST /v1/conversations/:id/calls`
- API/worker source reads: `services/greenfield-api/src/domains/calls/service.ts`, `services/greenfield-worker/src/push/voip.ts`
- API/worker source writes: `services/greenfield-api/src/domains/calls/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_checkpoints`

- Purpose: application state for greenfield checkpoints
- Primary key: `checkpoint_id`
- Foreign keys: `repository_id -> greenfield_repositories.repository_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_checkpoints_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `greenfield_collections`

- Purpose: application state for greenfield collections
- Primary key: `collection_id`
- Foreign keys: `repository_id -> greenfield_repositories.repository_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_collections_pkey`, `greenfield_collections_repository_id_name_key`
- Unique constraints: `greenfield_collections_repository_id_name_key(repository_id,name)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/accounts/verify-email`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/accounts/service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_comment_poll_votes`

- Purpose: application state for greenfield comment poll votes
- Primary key: `comment_id`, `actor_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `greenfield_comment_poll_votes_comment_idx`, `greenfield_comment_poll_votes_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `065_comments_rich.sql`
- Routes reading: `DELETE /v1/comments/:commentId/pin`, `PUT /v1/comments/:commentId/pin`, `PUT /v1/comments/:commentId/poll/vote`, `GET /v1/comments/:commentId/replies`, `POST /v1/comments/:commentId/replies`, `GET /v1/posts/:postId/comments`, `POST /v1/posts/:postId/comments`
- Routes writing: `PUT /v1/comments/:commentId/poll/vote`
- API/worker source reads: `services/greenfield-api/src/domains/comments/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/comments/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_comment_reactions`

- Purpose: application state for greenfield comment reactions
- Primary key: `reaction_id`
- Foreign keys: `actor_id -> actors.id`, `comment_id -> greenfield_comments.comment_id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `greenfield_comment_reactions_actor_id_comment_id_key`, `greenfield_comment_reactions_actor_idx`, `greenfield_comment_reactions_comment_idx`, `greenfield_comment_reactions_pkey`
- Unique constraints: `greenfield_comment_reactions_actor_id_comment_id_key(actor_id,comment_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: `DELETE /v1/comments/:commentId/pin`, `PUT /v1/comments/:commentId/pin`, `PUT /v1/comments/:commentId/poll/vote`, `DELETE /v1/comments/:commentId/reaction`, `PUT /v1/comments/:commentId/reaction`, `GET /v1/comments/:commentId/replies`, `POST /v1/comments/:commentId/replies`, `GET /v1/posts/:postId/comments`, `POST /v1/posts/:postId/comments`
- Routes writing: `DELETE /v1/comments/:commentId/reaction`, `PUT /v1/comments/:commentId/reaction`
- API/worker source reads: `services/greenfield-api/src/domains/comments/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/comments/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_comments`

- Purpose: application state for greenfield comments
- Primary key: `comment_id`
- Foreign keys: `author_actor_id -> actors.id`, `parent_comment_id -> greenfield_comments.comment_id`, `post_id -> posts.id`, `root_comment_id -> greenfield_comments.comment_id`
- Ownership/workspace/user/module columns: `author_actor_id`
- Indexes: `greenfield_comments_media_idx`, `greenfield_comments_parent_idx`, `greenfield_comments_pinned_idx`, `greenfield_comments_pkey`, `greenfield_comments_post_idx`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`, `pinned_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/admin/moderation/reports/:reportId/actions`, `POST /v1/admin/ops/policy/evaluate`, `GET /v1/attachments/:attachmentId/content`, `DELETE /v1/comments/:commentId`, `PATCH /v1/comments/:commentId`, `DELETE /v1/comments/:commentId/pin`, `PUT /v1/comments/:commentId/pin`, `PUT /v1/comments/:commentId/poll/vote`, `DELETE /v1/comments/:commentId/reaction`, `PUT /v1/comments/:commentId/reaction`, `GET /v1/comments/:commentId/replies`, `POST /v1/comments/:commentId/replies`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `GET /v1/creator/insights`, `GET /v1/hashtags/suggest`, `GET /v1/posts/:postId/comments`, `POST /v1/posts/:postId/comments`, `POST /v1/reports`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/admin/moderation/reports/:reportId/actions`, `DELETE /v1/comments/:commentId`, `PATCH /v1/comments/:commentId`, `DELETE /v1/comments/:commentId/pin`, `PUT /v1/comments/:commentId/pin`, `POST /v1/comments/:commentId/replies`, `POST /v1/posts/:postId/comments`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/app/register-composer-routes.ts`, `services/greenfield-api/src/domains/comments/media.ts`, `services/greenfield-api/src/domains/comments/service.ts`, `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/settings-v2/service.ts`, `services/greenfield-worker/src/digests/digests.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/domains/comments/service.ts`, `services/greenfield-api/src/domains/moderation/repository.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_commerce_invoices`

- Purpose: application state for greenfield commerce invoices
- Primary key: `invoice_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_commerce_invoices_account_idx`, `greenfield_commerce_invoices_invoice_number_key`, `greenfield_commerce_invoices_pkey`
- Unique constraints: `greenfield_commerce_invoices_invoice_number_key(invoice_number)`
- Soft delete: none
- Timestamps: `issued_at`, `paid_at`, `created_at`
- Migration introduced: `063_settings_backend_v2.sql`
- Routes reading: `GET /v1/commerce/invoices`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_communities`

- Purpose: application state for greenfield communities
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `086_greenfield_communities.sql`
- Routes reading: `POST /v1/admin/ops/policy/evaluate`, `GET /v1/attachments/:attachmentId/content`, `GET /v1/communities`, `POST /v1/communities`, `GET /v1/communities/:communityId`, `PATCH /v1/communities/:communityId`, `GET /v1/communities/:communityId/events`, `POST /v1/communities/:communityId/events`, `GET /v1/communities/:communityId/events/:eventId`, `PATCH /v1/communities/:communityId/events/:eventId`, `PUT /v1/communities/:communityId/events/:eventId/response`, `POST /v1/communities/:communityId/join`, `GET /v1/communities/:communityId/members`, `GET /v1/communities/:communityId/polls`, `POST /v1/communities/:communityId/polls`, `GET /v1/communities/:communityId/polls/:pollId`, `PATCH /v1/communities/:communityId/polls/:pollId`, `PUT /v1/communities/:communityId/polls/:pollId/vote`, `GET /v1/communities/:communityId/posts`, `GET /v1/communities/:communityId/settings`, `PATCH /v1/communities/:communityId/settings`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `POST /v1/posts`
- Routes writing: `POST /v1/communities`, `PATCH /v1/communities/:communityId`, `POST /v1/communities/:communityId/events`, `PATCH /v1/communities/:communityId/events/:eventId`, `POST /v1/communities/:communityId/join`, `POST /v1/communities/:communityId/leave`, `POST /v1/communities/:communityId/polls`, `PATCH /v1/communities/:communityId/settings`
- API/worker source reads: `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/domains/communities/service.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/domains/posts/writes.ts`
- API/worker source writes: `services/greenfield-api/src/domains/communities/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_community_event_responses`

- Purpose: application state for greenfield community event responses
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `086_greenfield_communities.sql`
- Routes reading: `GET /v1/communities/:communityId/events`, `POST /v1/communities/:communityId/events`, `GET /v1/communities/:communityId/events/:eventId`, `PATCH /v1/communities/:communityId/events/:eventId`, `PUT /v1/communities/:communityId/events/:eventId/response`
- Routes writing: `PUT /v1/communities/:communityId/events/:eventId/response`
- API/worker source reads: `services/greenfield-api/src/domains/communities/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/communities/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_community_events`

- Purpose: application state for greenfield community events
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `086_greenfield_communities.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/communities/:communityId/events`, `POST /v1/communities/:communityId/events`, `GET /v1/communities/:communityId/events/:eventId`, `PATCH /v1/communities/:communityId/events/:eventId`, `PUT /v1/communities/:communityId/events/:eventId/response`
- Routes writing: `POST /v1/communities/:communityId/events`, `PATCH /v1/communities/:communityId/events/:eventId`
- API/worker source reads: `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/domains/communities/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/communities/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_community_memberships`

- Purpose: application state for greenfield community memberships
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `086_greenfield_communities.sql`
- Routes reading: `POST /v1/admin/ops/policy/evaluate`, `GET /v1/attachments/:attachmentId/content`, `GET /v1/communities`, `POST /v1/communities`, `GET /v1/communities/:communityId`, `PATCH /v1/communities/:communityId`, `GET /v1/communities/:communityId/events`, `POST /v1/communities/:communityId/events`, `GET /v1/communities/:communityId/events/:eventId`, `PATCH /v1/communities/:communityId/events/:eventId`, `PUT /v1/communities/:communityId/events/:eventId/response`, `POST /v1/communities/:communityId/join`, `POST /v1/communities/:communityId/leave`, `GET /v1/communities/:communityId/members`, `GET /v1/communities/:communityId/polls`, `POST /v1/communities/:communityId/polls`, `GET /v1/communities/:communityId/polls/:pollId`, `PATCH /v1/communities/:communityId/polls/:pollId`, `PUT /v1/communities/:communityId/polls/:pollId/vote`, `GET /v1/communities/:communityId/posts`, `GET /v1/communities/:communityId/settings`, `PATCH /v1/communities/:communityId/settings`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `POST /v1/posts`, `PATCH /v1/posts/:postId`
- Routes writing: `POST /v1/communities`, `POST /v1/communities/:communityId/join`, `POST /v1/communities/:communityId/leave`, `PATCH /v1/communities/:communityId/settings`
- API/worker source reads: `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/domains/communities/service.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/domains/posts/writes.ts`
- API/worker source writes: `services/greenfield-api/src/domains/communities/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_community_poll_options`

- Purpose: application state for greenfield community poll options
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `086_greenfield_communities.sql`
- Routes reading: `GET /v1/communities/:communityId/polls`, `POST /v1/communities/:communityId/polls`, `GET /v1/communities/:communityId/polls/:pollId`, `PATCH /v1/communities/:communityId/polls/:pollId`, `PUT /v1/communities/:communityId/polls/:pollId/vote`
- Routes writing: `POST /v1/communities/:communityId/polls`
- API/worker source reads: `services/greenfield-api/src/domains/communities/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/communities/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_community_poll_votes`

- Purpose: application state for greenfield community poll votes
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `086_greenfield_communities.sql`
- Routes reading: `GET /v1/communities/:communityId/polls`, `POST /v1/communities/:communityId/polls`, `GET /v1/communities/:communityId/polls/:pollId`, `PATCH /v1/communities/:communityId/polls/:pollId`, `PUT /v1/communities/:communityId/polls/:pollId/vote`
- Routes writing: `PUT /v1/communities/:communityId/polls/:pollId/vote`
- API/worker source reads: `services/greenfield-api/src/domains/communities/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/communities/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_community_polls`

- Purpose: application state for greenfield community polls
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `086_greenfield_communities.sql`
- Routes reading: `GET /v1/communities/:communityId/polls`, `POST /v1/communities/:communityId/polls`, `GET /v1/communities/:communityId/polls/:pollId`, `PATCH /v1/communities/:communityId/polls/:pollId`, `PUT /v1/communities/:communityId/polls/:pollId/vote`
- Routes writing: `POST /v1/communities/:communityId/polls`, `PATCH /v1/communities/:communityId/polls/:pollId`
- API/worker source reads: `services/greenfield-api/src/domains/communities/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/communities/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_community_settings`

- Purpose: application state for greenfield community settings
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `086_greenfield_communities.sql`
- Routes reading: `POST /v1/admin/ops/policy/evaluate`, `GET /v1/communities/:communityId/settings`, `PATCH /v1/communities/:communityId/settings`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `POST /v1/posts`, `PATCH /v1/posts/:postId`
- Routes writing: `POST /v1/communities`, `PATCH /v1/communities/:communityId`, `PATCH /v1/communities/:communityId/settings`
- API/worker source reads: `services/greenfield-api/src/domains/communities/service.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/domains/posts/writes.ts`
- API/worker source writes: `services/greenfield-api/src/domains/communities/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_connection_credentials`

- Purpose: application state for greenfield connection credentials
- Primary key: `credential_id`
- Foreign keys: `connection_id -> greenfield_connections.connection_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_connection_credentials_connection_idx`, `greenfield_connection_credentials_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `expires_at`, `created_at`, `updated_at`
- Migration introduced: `016_phase7d_connector_foundation.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`
- API/worker source reads: `services/greenfield-api/src/domains/connectors/credentials/repository.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/domains/connectors/credentials/repository.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_connection_events`

- Purpose: application state for greenfield connection events
- Primary key: `event_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `connection_id -> greenfield_connections.connection_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_connection_events_account_idx`, `greenfield_connection_events_connection_idx`, `greenfield_connection_events_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `016_phase7d_connector_foundation.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/domains/connectors/connections/repository.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_connection_permissions`

- Purpose: application state for greenfield connection permissions
- Primary key: `permission_id`
- Foreign keys: `connection_id -> greenfield_connections.connection_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_connection_permissions_connection_id_capability_key`, `greenfield_connection_permissions_connection_idx`, `greenfield_connection_permissions_pkey`
- Unique constraints: `greenfield_connection_permissions_connection_id_capability_key(connection_id,capability)`
- Soft delete: none
- Timestamps: `granted_at`, `revoked_at`, `created_at`, `updated_at`
- Migration introduced: `016_phase7d_connector_foundation.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/connectors/connections/repository.ts`
- API/worker source writes: `services/greenfield-api/src/domains/connectors/connections/repository.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_connection_scopes`

- Purpose: application state for greenfield connection scopes
- Primary key: `scope_id`
- Foreign keys: `connection_id -> greenfield_connections.connection_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_connection_scopes_connection_id_scope_key`, `greenfield_connection_scopes_connection_idx`, `greenfield_connection_scopes_pkey`
- Unique constraints: `greenfield_connection_scopes_connection_id_scope_key(connection_id,scope)`
- Soft delete: none
- Timestamps: `granted_at`, `revoked_at`
- Migration introduced: `016_phase7d_connector_foundation.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/connectors/connections/repository.ts`
- API/worker source writes: `services/greenfield-api/src/domains/connectors/connections/repository.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_connection_sync_state`

- Purpose: application state for greenfield connection sync state
- Primary key: `sync_state_id`
- Foreign keys: `connection_id -> greenfield_connections.connection_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_connection_sync_stat_connection_id_resource_kind_key`, `greenfield_connection_sync_state_connection_idx`, `greenfield_connection_sync_state_pkey`
- Unique constraints: `greenfield_connection_sync_stat_connection_id_resource_kind_key(connection_id,resource_kind)`
- Soft delete: none
- Timestamps: `last_started_at`, `last_completed_at`, `created_at`, `updated_at`
- Migration introduced: `016_phase7d_connector_foundation.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `greenfield_connections`

- Purpose: application state for greenfield connections
- Primary key: `connection_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `provider_id -> greenfield_connector_providers.provider_id`
- Ownership/workspace/user/module columns: `account_id`, `external_account_id`
- Indexes: `greenfield_connections_account_idx`, `greenfield_connections_pkey`, `greenfield_connections_provider_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `connected_at`, `last_refreshed_at`, `last_used_at`, `expires_at`, `revoked_at`, `created_at`, `updated_at`, `health_checked_at`
- Migration introduced: `016_phase7d_connector_foundation.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/admin/ops/policy/evaluate`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/domains/connectors/connections/repository.ts`, `services/greenfield-api/src/domains/connectors/credentials/repository.ts`, `services/greenfield-api/src/domains/policy/engine.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/domains/connectors/connections/repository.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_connector_oauth_states`

- Purpose: application state for greenfield connector oauth states
- Primary key: `state_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `provider_id -> greenfield_connector_providers.provider_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_connector_oauth_states_account_idx`, `greenfield_connector_oauth_states_expiry_idx`, `greenfield_connector_oauth_states_idempotency_idx`, `greenfield_connector_oauth_states_pkey`, `greenfield_connector_oauth_states_state_hash_key`
- Unique constraints: `greenfield_connector_oauth_states_state_hash_key(state_hash)`
- Soft delete: none
- Timestamps: `created_at`, `authorising_at`, `expires_at`, `consumed_at`, `cancelled_at`, `failed_at`, `replay_detected_at`, `consume_attempt_count`
- Migration introduced: `017_phase7d_connector_security_lifecycle.sql`
- Routes reading: `POST /v1/connectors/:providerId/authorise`
- Routes writing: `POST /v1/connectors/:providerId/authorise`
- API/worker source reads: `services/greenfield-api/src/domains/connectors/oauth-state/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/connectors/oauth-state/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_connector_providers`

- Purpose: application state for greenfield connector providers
- Primary key: `provider_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_connector_providers_capabilities_idx`, `greenfield_connector_providers_kinds_idx`, `greenfield_connector_providers_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `016_phase7d_connector_foundation.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `greenfield_connectors`

- Purpose: application state for greenfield connectors
- Primary key: `connector_id`
- Foreign keys: `extension_version_id -> greenfield_extension_versions.extension_version_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_connectors_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-worker/src/modules/contribution-registration-handler.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_conversation_members`

- Purpose: application state for greenfield conversation members
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `075_greenfield_messaging.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/conversations`, `POST /v1/conversations`, `POST /v1/conversations/:id/archive`, `POST /v1/conversations/:id/calls`, `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages`, `DELETE /v1/conversations/:id/messages/:messageId`, `PATCH /v1/conversations/:id/messages/:messageId`, `DELETE /v1/conversations/:id/messages/:messageId/reactions`, `GET /v1/conversations/:id/messages/:messageId/reactions`, `PUT /v1/conversations/:id/messages/:messageId/reactions`, `GET /v1/conversations/:id/messages/:messageId/receipts`, `POST /v1/conversations/:id/mute`, `POST /v1/conversations/:id/read`, `GET /v1/conversations/:id/typing`, `POST /v1/conversations/:id/typing`, `GET /v1/conversations/unread`, `POST /v1/groups`, `GET /v1/groups/:id`, `PATCH /v1/groups/:id`, `POST /v1/groups/:id/leave`, `POST /v1/groups/:id/members`, `DELETE /v1/groups/:id/members/:actorId`, `POST /v1/groups/:id/members/:actorId/role`, `GET /v1/in-mail`, `POST /v1/in-mail`, `GET /v1/in-mail/:id`, `POST /v1/in-mail/:id/replies`, `GET /v1/me/calls`, `GET /v1/message-requests`, `POST /v1/message-requests/:id/accept`, `POST /v1/message-requests/:id/decline`, `GET /v1/messages/search`, `GET /v1/messaging/socket`, `GET /v1/presence`
- Routes writing: `POST /v1/conversations`, `POST /v1/conversations/:id/archive`, `POST /v1/conversations/:id/messages`, `POST /v1/conversations/:id/mute`, `POST /v1/conversations/:id/read`, `POST /v1/conversations/:id/typing`, `POST /v1/groups`, `POST /v1/groups/:id/leave`, `POST /v1/groups/:id/members`, `DELETE /v1/groups/:id/members/:actorId`, `POST /v1/groups/:id/members/:actorId/role`, `POST /v1/in-mail`, `GET /v1/in-mail/:id`, `POST /v1/in-mail/:id/replies`, `POST /v1/message-requests/:id/accept`, `POST /v1/message-requests/:id/decline`, `PATCH /v1/messaging/privacy`, `GET /v1/messaging/socket`
- API/worker source reads: `services/greenfield-api/src/domains/calls/service.ts`, `services/greenfield-api/src/domains/messaging/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/messaging/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_conversation_messages`

- Purpose: application state for greenfield conversation messages
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `075_greenfield_messaging.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/conversations`, `POST /v1/conversations`, `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages`, `DELETE /v1/conversations/:id/messages/:messageId`, `PATCH /v1/conversations/:id/messages/:messageId`, `DELETE /v1/conversations/:id/messages/:messageId/reactions`, `GET /v1/conversations/:id/messages/:messageId/reactions`, `PUT /v1/conversations/:id/messages/:messageId/reactions`, `GET /v1/conversations/:id/messages/:messageId/receipts`, `GET /v1/conversations/unread`, `POST /v1/groups`, `GET /v1/in-mail`, `POST /v1/in-mail`, `GET /v1/in-mail/:id`, `GET /v1/message-requests`, `POST /v1/message-requests/:id/accept`, `GET /v1/messages/search`
- Routes writing: `POST /v1/conversations`, `POST /v1/conversations/:id/messages`, `DELETE /v1/conversations/:id/messages/:messageId`, `PATCH /v1/conversations/:id/messages/:messageId`, `POST /v1/in-mail`, `POST /v1/in-mail/:id/replies`
- API/worker source reads: `services/greenfield-api/src/domains/messaging/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/messaging/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_conversations`

- Purpose: application state for greenfield conversations
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `075_greenfield_messaging.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/conversations`, `POST /v1/conversations`, `POST /v1/conversations/:id/archive`, `POST /v1/conversations/:id/calls`, `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages`, `DELETE /v1/conversations/:id/messages/:messageId`, `PATCH /v1/conversations/:id/messages/:messageId`, `DELETE /v1/conversations/:id/messages/:messageId/reactions`, `GET /v1/conversations/:id/messages/:messageId/reactions`, `PUT /v1/conversations/:id/messages/:messageId/reactions`, `GET /v1/conversations/:id/messages/:messageId/receipts`, `POST /v1/conversations/:id/mute`, `POST /v1/conversations/:id/read`, `GET /v1/conversations/:id/typing`, `POST /v1/conversations/:id/typing`, `GET /v1/conversations/unread`, `POST /v1/groups`, `GET /v1/groups/:id`, `PATCH /v1/groups/:id`, `POST /v1/groups/:id/leave`, `POST /v1/groups/:id/members`, `DELETE /v1/groups/:id/members/:actorId`, `POST /v1/groups/:id/members/:actorId/role`, `GET /v1/in-mail`, `POST /v1/in-mail`, `GET /v1/in-mail/:id`, `POST /v1/in-mail/:id/replies`, `GET /v1/message-requests`, `POST /v1/message-requests/:id/accept`, `POST /v1/message-requests/:id/decline`, `GET /v1/messages/search`, `GET /v1/messaging/socket`, `GET /v1/presence`
- Routes writing: `POST /v1/conversations`, `POST /v1/conversations/:id/messages`, `POST /v1/groups`, `PATCH /v1/groups/:id`, `POST /v1/in-mail`, `POST /v1/in-mail/:id/replies`
- API/worker source reads: `services/greenfield-api/src/domains/calls/service.ts`, `services/greenfield-api/src/domains/messaging/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/messaging/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_creator_ledger_entries`

- Purpose: application state for greenfield creator ledger entries
- Primary key: `entry_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_creator_ledger_account_idx`, `greenfield_creator_ledger_entries_pkey`, `greenfield_creator_ledger_entries_source_source_reference_key`
- Unique constraints: `greenfield_creator_ledger_entries_source_source_reference_key(source,source_reference)`
- Soft delete: none
- Timestamps: `occurred_at`, `created_at`
- Migration introduced: `063_settings_backend_v2.sql`
- Routes reading: `GET /v1/creator/payouts`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_data_backup_policies`

- Purpose: application state for greenfield data backup policies
- Primary key: `backup_policy_id`
- Foreign keys: `resource_id -> greenfield_data_resources.resource_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_data_backup_policies_pkey`, `greenfield_data_backup_policies_resource_id_key`
- Unique constraints: `greenfield_data_backup_policies_resource_id_key(resource_id)`
- Soft delete: none
- Timestamps: `last_backup_at`, `last_restore_test_at`, `created_at`, `updated_at`
- Migration introduced: `041_greenfield_backend_v1_data_ledger.sql`
- Routes reading: `GET /v1/backend/products/:productId/installations/:installationId/resources`, `POST /v1/backend/products/:productId/resources`, `GET /v1/backend/products/:productId/resources/:resourceId`, `POST /v1/backend/products/:productId/resources/:resourceId/migrations`, `POST /v1/backend/products/:productId/resources/:resourceId/schemas`, `GET /v1/modules/:moduleId/data-resources`, `POST /v1/modules/:moduleId/data-resources`, `GET /v1/modules/:moduleId/data-resources/:resourceId`, `POST /v1/modules/:moduleId/data-resources/:resourceId/migrations`, `POST /v1/modules/:moduleId/data-resources/:resourceId/schemas`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/data-ledger/service.ts`
- API/worker source writes: `services/greenfield-api/src/data-ledger/service.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_data_migration_history`

- Purpose: application state for greenfield data migration history
- Primary key: `migration_history_id`
- Foreign keys: `resource_id -> greenfield_data_resources.resource_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_data_migration_his_resource_id_migration_id_atte_key`, `greenfield_data_migration_history_pkey`, `greenfield_data_migration_history_resource_idx`
- Unique constraints: `greenfield_data_migration_his_resource_id_migration_id_atte_key(resource_id,migration_id,attempt)`
- Soft delete: none
- Timestamps: `started_at`, `finished_at`, `created_at`
- Migration introduced: `041_greenfield_backend_v1_data_ledger.sql`
- Routes reading: `POST /v1/backend/products/:productId/resources/:resourceId/migrations`, `POST /v1/modules/:moduleId/data-resources/:resourceId/migrations`
- Routes writing: `POST /v1/backend/products/:productId/resources/:resourceId/migrations`, `POST /v1/modules/:moduleId/data-resources/:resourceId/migrations`
- API/worker source reads: `services/greenfield-api/src/data-ledger/service.ts`
- API/worker source writes: `services/greenfield-api/src/data-ledger/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_data_resource_owners`

- Purpose: application state for greenfield data resource owners
- Primary key: `owner_binding_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `resource_id -> greenfield_data_resources.resource_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_data_resource_owne_resource_id_account_id_owner__key`, `greenfield_data_resource_owners_account_idx`, `greenfield_data_resource_owners_pkey`, `greenfield_data_resource_primary_owner_idx`
- Unique constraints: `greenfield_data_resource_owne_resource_id_account_id_owner__key(resource_id,account_id,owner_role)`
- Soft delete: none
- Timestamps: `created_at`, `released_at`
- Migration introduced: `041_greenfield_backend_v1_data_ledger.sql`
- Routes reading: `GET /v1/backend/products/:productId/installations/:installationId/resources`, `POST /v1/backend/products/:productId/resources`, `GET /v1/backend/products/:productId/resources/:resourceId`, `POST /v1/backend/products/:productId/resources/:resourceId/migrations`, `POST /v1/backend/products/:productId/resources/:resourceId/schemas`, `GET /v1/modules/:moduleId/data-resources`, `POST /v1/modules/:moduleId/data-resources`, `GET /v1/modules/:moduleId/data-resources/:resourceId`, `POST /v1/modules/:moduleId/data-resources/:resourceId/migrations`, `POST /v1/modules/:moduleId/data-resources/:resourceId/schemas`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`
- API/worker source reads: `services/greenfield-api/src/data-ledger/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/data-ledger/service.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_data_resources`

- Purpose: application state for greenfield data resources
- Primary key: `resource_id`
- Foreign keys: `installation_id -> greenfield_extension_installations.installation_id`, `owner_account_id -> greenfield_accounts.account_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `owner_account_id`, `product_id`, `installation_id`
- Indexes: `greenfield_data_resources_installation_id_resource_key_key`, `greenfield_data_resources_installation_idx`, `greenfield_data_resources_owner_account_id_product_id_idemp_key`, `greenfield_data_resources_owner_idx`, `greenfield_data_resources_pkey`, `greenfield_data_resources_release_idx`
- Unique constraints: `greenfield_data_resources_installation_id_resource_key_key(installation_id,resource_key)`, `greenfield_data_resources_owner_account_id_product_id_idemp_key(owner_account_id,product_id,idempotency_key)`
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `041_greenfield_backend_v1_data_ledger.sql`
- Routes reading: `POST /v1/account/data-exports`, `POST /v1/account/deletion-requests`, `GET /v1/backend/products/:productId/installations/:installationId/resources`, `POST /v1/backend/products/:productId/resources`, `GET /v1/backend/products/:productId/resources/:resourceId`, `POST /v1/backend/products/:productId/resources/:resourceId/migrations`, `POST /v1/backend/products/:productId/resources/:resourceId/schemas`, `GET /v1/modules/:moduleId/data-resources`, `POST /v1/modules/:moduleId/data-resources`, `GET /v1/modules/:moduleId/data-resources/:resourceId`, `POST /v1/modules/:moduleId/data-resources/:resourceId/migrations`, `POST /v1/modules/:moduleId/data-resources/:resourceId/schemas`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/backend/products/:productId/resources`, `POST /v1/backend/products/:productId/resources/:resourceId/migrations`, `POST /v1/modules/:moduleId/data-resources`, `POST /v1/modules/:moduleId/data-resources/:resourceId/migrations`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/data-ledger/service.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/data-ledger/service.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_data_retention_policies`

- Purpose: application state for greenfield data retention policies
- Primary key: `retention_policy_id`
- Foreign keys: `resource_id -> greenfield_data_resources.resource_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_data_retention_policies_pkey`, `greenfield_data_retention_policies_resource_id_key`
- Unique constraints: `greenfield_data_retention_policies_resource_id_key(resource_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `041_greenfield_backend_v1_data_ledger.sql`
- Routes reading: `POST /v1/account/data-exports`, `POST /v1/account/deletion-requests`, `GET /v1/backend/products/:productId/installations/:installationId/resources`, `POST /v1/backend/products/:productId/resources`, `GET /v1/backend/products/:productId/resources/:resourceId`, `POST /v1/backend/products/:productId/resources/:resourceId/migrations`, `POST /v1/backend/products/:productId/resources/:resourceId/schemas`, `GET /v1/modules/:moduleId/data-resources`, `POST /v1/modules/:moduleId/data-resources`, `GET /v1/modules/:moduleId/data-resources/:resourceId`, `POST /v1/modules/:moduleId/data-resources/:resourceId/migrations`, `POST /v1/modules/:moduleId/data-resources/:resourceId/schemas`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/data-ledger/service.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts`
- API/worker source writes: `services/greenfield-api/src/data-ledger/service.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_data_schema_versions`

- Purpose: application state for greenfield data schema versions
- Primary key: `schema_version_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`, `resource_id -> greenfield_data_resources.resource_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_data_schema_versions_pkey`, `greenfield_data_schema_versions_resource_id_version_key`, `greenfield_data_schema_versions_resource_idx`
- Unique constraints: `greenfield_data_schema_versions_resource_id_version_key(resource_id,version)`
- Soft delete: none
- Timestamps: `declared_at`, `activated_at`, `superseded_at`
- Migration introduced: `041_greenfield_backend_v1_data_ledger.sql`
- Routes reading: `GET /v1/backend/products/:productId/installations/:installationId/resources`, `POST /v1/backend/products/:productId/resources`, `GET /v1/backend/products/:productId/resources/:resourceId`, `POST /v1/backend/products/:productId/resources/:resourceId/migrations`, `POST /v1/backend/products/:productId/resources/:resourceId/schemas`, `GET /v1/modules/:moduleId/data-resources`, `POST /v1/modules/:moduleId/data-resources`, `GET /v1/modules/:moduleId/data-resources/:resourceId`, `POST /v1/modules/:moduleId/data-resources/:resourceId/migrations`, `POST /v1/modules/:moduleId/data-resources/:resourceId/schemas`
- Routes writing: `POST /v1/backend/products/:productId/resources/:resourceId/migrations`, `POST /v1/backend/products/:productId/resources/:resourceId/schemas`, `POST /v1/modules/:moduleId/data-resources/:resourceId/migrations`, `POST /v1/modules/:moduleId/data-resources/:resourceId/schemas`
- API/worker source reads: `services/greenfield-api/src/data-ledger/service.ts`
- API/worker source writes: `services/greenfield-api/src/data-ledger/service.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_data_storage_bindings`

- Purpose: application state for greenfield data storage bindings
- Primary key: `binding_id`
- Foreign keys: `resource_id -> greenfield_data_resources.resource_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_data_storage_bindi_resource_id_storage_mode_loca_key`, `greenfield_data_storage_bindings_pkey`, `greenfield_data_storage_bindings_resource_idx`, `greenfield_data_storage_bindings_service_idx`
- Unique constraints: `greenfield_data_storage_bindi_resource_id_storage_mode_loca_key(resource_id,storage_mode,locator_ref)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `retired_at`
- Migration introduced: `041_greenfield_backend_v1_data_ledger.sql`
- Routes reading: `GET /v1/backend/products/:productId/installations/:installationId/resources`, `POST /v1/backend/products/:productId/resources`, `GET /v1/backend/products/:productId/resources/:resourceId`, `POST /v1/backend/products/:productId/resources/:resourceId/migrations`, `POST /v1/backend/products/:productId/resources/:resourceId/schemas`, `GET /v1/modules/:moduleId/data-resources`, `POST /v1/modules/:moduleId/data-resources`, `GET /v1/modules/:moduleId/data-resources/:resourceId`, `POST /v1/modules/:moduleId/data-resources/:resourceId/migrations`, `POST /v1/modules/:moduleId/data-resources/:resourceId/schemas`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`
- API/worker source reads: `services/greenfield-api/src/data-ledger/service.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/data-ledger/service.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_developer_agreement_acceptances`

- Purpose: application state for greenfield developer agreement acceptances
- Primary key: `acceptance_id`
- Foreign keys: `agreement_id -> greenfield_developer_agreements.agreement_id`, `agreement_id -> greenfield_developer_agreements.version`, `agreement_version -> greenfield_developer_agreements.agreement_id`, `agreement_version -> greenfield_developer_agreements.version`, `accepted_by_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `accepted_by_account_id`
- Indexes: `greenfield_developer_agreemen_agreement_id_agreement_versio_key`, `greenfield_developer_agreement_acceptances_pkey`
- Unique constraints: `greenfield_developer_agreemen_agreement_id_agreement_versio_key(agreement_id,agreement_version,accepted_by_account_id)`
- Soft delete: none
- Timestamps: `accepted_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `POST /v1/developer/agreements/:agreementId/:version/accept`
- Routes writing: `POST /v1/developer/agreements/:agreementId/:version/accept`
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_developer_agreements`

- Purpose: application state for greenfield developer agreements
- Primary key: `agreement_id`, `version`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_developer_agreements_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `effective_at`, `superseded_at`, `created_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `POST /v1/developer/agreements/:agreementId/:version/accept`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_developer_builds`

- Purpose: application state for greenfield developer builds
- Primary key: `build_id`
- Foreign keys: `created_by_account_id -> greenfield_accounts.account_id`, `product_id -> greenfield_developer_products.product_id`, `source_connection_id -> greenfield_developer_source_connections.source_connection_id`
- Ownership/workspace/user/module columns: `product_id`, `created_by_account_id`
- Indexes: `greenfield_developer_builds_claim_idx`, `greenfield_developer_builds_idempotency_idx`, `greenfield_developer_builds_pkey`, `greenfield_developer_builds_product_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `started_at`, `finished_at`, `maximum_attempts`, `lease_expires_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `GET /v1/developer/board`, `GET /v1/developer/products/:productId`, `POST /v1/developer/products/:productId/builds`, `POST /v1/developer/products/:productId/releases`, `POST /v1/internal/build-service/builds/:buildId/result`, `POST /v1/internal/build-service/claims`
- Routes writing: `POST /v1/developer/products/:productId/builds`, `POST /v1/internal/build-service/builds/:buildId/result`, `POST /v1/internal/build-service/claims`
- API/worker source reads: `services/greenfield-api/src/developers/build-coordinator.ts`, `services/greenfield-api/src/developers/service.ts`
- API/worker source writes: `services/greenfield-api/src/developers/build-coordinator.ts`, `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_developer_organisation_memberships`

- Purpose: application state for greenfield developer organisation memberships
- Primary key: `membership_id`
- Foreign keys: `invited_by_account_id -> greenfield_accounts.account_id`, `organisation_id -> greenfield_developer_organisations.organisation_id`, `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `invited_by_account_id`
- Indexes: `greenfield_developer_memberships_account_idx`, `greenfield_developer_organisatio_organisation_id_account_id_key`, `greenfield_developer_organisation_memberships_pkey`
- Unique constraints: `greenfield_developer_organisatio_organisation_id_account_id_key(organisation_id,account_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `GET /v1/developer/board`, `PUT /v1/developer/gubic/games/:gameId`, `GET /v1/developer/gubic/submissions`, `POST /v1/developer/gubic/submissions`, `POST /v1/developer/gubic/submissions/:submissionId/withdraw`, `POST /v1/developer/organisations/:organisationId/members`, `GET /v1/developer/products`, `POST /v1/developer/products`, `GET /v1/developer/products/:productId`, `POST /v1/developer/products/:productId/builds`, `POST /v1/developer/products/:productId/releases`, `PUT /v1/developer/products/:productId/releases/:releaseId/test-groups/:testGroupId`, `POST /v1/developer/products/:productId/reviews`, `POST /v1/developer/products/:productId/sources`, `POST /v1/developer/products/:productId/test-groups`, `POST /v1/developer/publishers`, `POST /v1/developer/publishers/:publisherId/namespaces`, `POST /v1/intelligence/missions`, `GET /v1/publisher/modules`
- Routes writing: `POST /v1/developer/organisations`, `POST /v1/developer/organisations/:organisationId/invitations/accept`, `POST /v1/developer/organisations/:organisationId/members`
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`, `services/greenfield-api/src/gubic/play-service.ts`, `services/greenfield-api/src/intelligence/action-boundary.ts`, `services/greenfield-api/src/intelligence/service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`, `services/greenfield-api/src/publisher/release-job-service.ts`
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_developer_organisations`

- Purpose: application state for greenfield developer organisations
- Primary key: `organisation_id`
- Foreign keys: `created_by_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `created_by_account_id`
- Indexes: `greenfield_developer_organisations_pkey`, `greenfield_developer_organisations_slug_key`
- Unique constraints: `greenfield_developer_organisations_slug_key(slug)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `POST /v1/admin/commerce/entitlements`, `GET /v1/developer/board`
- Routes writing: `POST /v1/developer/organisations`
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`, `services/greenfield-api/src/entitlements/service.ts`
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_developer_products`

- Purpose: application state for greenfield developer products
- Primary key: `product_id`
- Foreign keys: `extension_id -> greenfield_extensions.extension_id`, `owner_account_id -> greenfield_accounts.account_id`, `owner_organisation_id -> greenfield_developer_organisations.organisation_id`, `publisher_id -> greenfield_publishers.publisher_id`
- Ownership/workspace/user/module columns: `product_id`, `owner_account_id`
- Indexes: `greenfield_developer_products_owner_account_idx`, `greenfield_developer_products_owner_org_idx`, `greenfield_developer_products_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `GET /v1/developer/board`, `GET /v1/developer/products`, `GET /v1/developer/products/:productId`, `POST /v1/developer/products/:productId/builds`, `POST /v1/developer/products/:productId/releases`, `PUT /v1/developer/products/:productId/releases/:releaseId/test-groups/:testGroupId`, `POST /v1/developer/products/:productId/reviews`, `POST /v1/developer/products/:productId/sources`, `POST /v1/developer/products/:productId/test-groups`, `GET /v1/publisher/modules`, `GET /v1/publisher/modules/:moduleId`, `GET /v1/publisher/modules/:moduleId/github-releases`, `GET /v1/publisher/modules/:moduleId/release-jobs`, `POST /v1/publisher/modules/:moduleId/release-jobs`, `GET /v1/publisher/modules/:moduleId/versions`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/developer/products`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/developers/service.ts`, `services/greenfield-api/src/publisher/release-job-service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_developer_profiles`

- Purpose: application state for greenfield developer profiles
- Primary key: `account_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_developer_profiles_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `GET /v1/developer/board`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `PUT /v1/developer/profile`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/developers/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_developer_programme_memberships`

- Purpose: application state for greenfield developer programme memberships
- Primary key: `programme_membership_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `organisation_id -> greenfield_developer_organisations.organisation_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_developer_programme_m_account_id_organisation_id_key`, `greenfield_developer_programme_memberships_pkey`
- Unique constraints: `greenfield_developer_programme_m_account_id_organisation_id_key(account_id,organisation_id)`
- Soft delete: none
- Timestamps: `started_at`, `ended_at`, `created_at`, `updated_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `GET /v1/developer/board`, `POST /v1/developer/products`, `POST /v1/developer/products/:productId/reviews`
- Routes writing: `PATCH /v1/admin/developer/programme/:accountId`, `POST /v1/developer/programme/enrol`
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_developer_release_test_groups`

- Purpose: application state for greenfield developer release test groups
- Primary key: `developer_release_id`, `test_group_id`
- Foreign keys: `developer_release_id -> greenfield_developer_releases.developer_release_id`, `test_group_id -> greenfield_developer_test_groups.test_group_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_developer_release_test_groups_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `assigned_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: none observed
- Routes writing: `PUT /v1/developer/products/:productId/releases/:releaseId/test-groups/:testGroupId`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_developer_releases`

- Purpose: application state for greenfield developer releases
- Primary key: `developer_release_id`
- Foreign keys: `build_id -> greenfield_developer_builds.build_id`, `module_release_id -> greenfield_module_releases.release_id`, `product_id -> greenfield_developer_products.product_id`
- Ownership/workspace/user/module columns: `product_id`
- Indexes: `greenfield_developer_releases_pkey`, `greenfield_developer_releases_product_id_version_channel_key`
- Unique constraints: `greenfield_developer_releases_product_id_version_channel_key(product_id,version,channel)`
- Soft delete: none
- Timestamps: `released_at`, `created_at`, `updated_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `GET /v1/developer/board`, `GET /v1/developer/products/:productId`, `PUT /v1/developer/products/:productId/releases/:releaseId/test-groups/:testGroupId`, `POST /v1/developer/products/:productId/reviews`
- Routes writing: `POST /v1/developer/products/:productId/releases`
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_developer_review_submissions`

- Purpose: application state for greenfield developer review submissions
- Primary key: `review_submission_id`
- Foreign keys: `submitted_by_account_id -> greenfield_accounts.account_id`, `developer_release_id -> greenfield_developer_releases.developer_release_id`, `reviewer_account_id -> greenfield_accounts.account_id`, `product_id -> greenfield_developer_products.product_id`
- Ownership/workspace/user/module columns: `product_id`, `submitted_by_account_id`, `reviewer_account_id`
- Indexes: `greenfield_developer_review_submissions_pkey`, `greenfield_developer_reviews_queue_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `submitted_at`, `decided_at`, `created_at`, `updated_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `GET /v1/developer/board`, `GET /v1/developer/products/:productId`
- Routes writing: `POST /v1/developer/products/:productId/reviews`
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_developer_source_connections`

- Purpose: application state for greenfield developer source connections
- Primary key: `source_connection_id`
- Foreign keys: `created_by_account_id -> greenfield_accounts.account_id`, `product_id -> greenfield_developer_products.product_id`
- Ownership/workspace/user/module columns: `product_id`, `created_by_account_id`
- Indexes: `greenfield_developer_source_c_product_id_provider_repositor_key`, `greenfield_developer_source_connections_pkey`
- Unique constraints: `greenfield_developer_source_c_product_id_provider_repositor_key(product_id,provider,repository)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `revoked_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `GET /v1/developer/products/:productId`, `POST /v1/developer/products/:productId/builds`, `POST /v1/internal/build-service/builds/:buildId/result`, `POST /v1/internal/build-service/claims`, `GET /v1/publisher/modules`, `GET /v1/publisher/modules/:moduleId`, `GET /v1/publisher/modules/:moduleId/github-releases`, `GET /v1/publisher/modules/:moduleId/release-jobs`, `POST /v1/publisher/modules/:moduleId/release-jobs`, `GET /v1/publisher/modules/:moduleId/versions`
- Routes writing: `POST /v1/developer/products/:productId/sources`
- API/worker source reads: `services/greenfield-api/src/developers/build-coordinator.ts`, `services/greenfield-api/src/developers/service.ts`, `services/greenfield-api/src/publisher/release-job-service.ts`
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_developer_test_group_members`

- Purpose: application state for greenfield developer test group members
- Primary key: `test_group_id`, `account_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `test_group_id -> greenfield_developer_test_groups.test_group_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_developer_test_group_members_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `added_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `GET /v1/developer/board`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_developer_test_groups`

- Purpose: application state for greenfield developer test groups
- Primary key: `test_group_id`
- Foreign keys: `created_by_account_id -> greenfield_accounts.account_id`, `product_id -> greenfield_developer_products.product_id`
- Ownership/workspace/user/module columns: `product_id`, `created_by_account_id`
- Indexes: `greenfield_developer_test_groups_pkey`, `greenfield_developer_test_groups_product_id_name_key`
- Unique constraints: `greenfield_developer_test_groups_product_id_name_key(product_id,name)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `GET /v1/developer/board`, `GET /v1/developer/products/:productId`, `PUT /v1/developer/products/:productId/releases/:releaseId/test-groups/:testGroupId`
- Routes writing: `POST /v1/developer/products/:productId/test-groups`
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_digest_deliveries`

- Purpose: application state for greenfield digest deliveries
- Primary key: `account_id`, `digest_kind`, `period_key`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_digest_deliveries_pkey`, `greenfield_digest_deliveries_recent_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `063_settings_backend_v2.sql`
- Routes reading: `GET /v1/accounts/me/app-preferences`, `PATCH /v1/accounts/me/app-preferences`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: `services/greenfield-worker/src/digests/digests.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_domain_events`

- Purpose: application state for greenfield domain events
- Primary key: `event_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `actor_id -> actors.id`
- Ownership/workspace/user/module columns: `account_id`, `actor_id`, `product_id`, `installation_id`
- Indexes: `greenfield_domain_events_account_idx`, `greenfield_domain_events_actor_idx`, `greenfield_domain_events_aggregate_idx`, `greenfield_domain_events_classification_idx`, `greenfield_domain_events_idempotency_idx`, `greenfield_domain_events_pkey`, `greenfield_domain_events_producer_idx`, `greenfield_domain_events_product_idx`, `greenfield_domain_events_request_idx`, `greenfield_domain_events_trace_idx`, `greenfield_domain_events_type_time_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `occurred_at`, `recorded_at`
- Migration introduced: `018_phase7e_internal_events.sql`
- Routes reading: `POST /v1/admin/ops/events/dead-letters/retry`, `POST /v1/admin/ops/events/replay`, `GET /v1/admin/ops/events/subscriber-failures`, `GET /v1/conversations/:id/messages`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/messaging/service.ts`, `services/greenfield-api/src/events/domain-events.ts`, `services/greenfield-api/src/events/replay.ts`, `services/greenfield-worker/src/events/runner.ts`, `services/greenfield-worker/src/search/index.ts`
- API/worker source writes: `services/greenfield-api/src/events/domain-events.ts`, `services/greenfield-worker/src/search/index.ts`, `services/greenfield-worker/src/search/projector.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_email_verifications`

- Purpose: application state for greenfield email verifications
- Primary key: `verification_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_email_verifications_pkey`, `greenfield_email_verifications_token_hash_key`
- Unique constraints: `greenfield_email_verifications_token_hash_key(token_hash)`
- Soft delete: none
- Timestamps: `expires_at`, `consumed_at`, `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/accounts/verify-email`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/accounts/register`, `POST /v1/accounts/verify-email`
- API/worker source reads: `services/greenfield-api/src/accounts/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/accounts/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_engine_capability_registrations`

- Purpose: application state for greenfield engine capability registrations
- Primary key: `engine_id`, `capability`
- Foreign keys: `engine_id -> greenfield_engine_registrations.engine_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_engine_capability_registrations_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `044_greenfield_backend_v1_engine_fabric.sql`
- Routes reading: `GET /v1/admin/ops/engines`, `GET /v1/admin/ops/engines/:engineId`, `GET /v1/meta`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/engines/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_engine_event_consumer_registrations`

- Purpose: application state for greenfield engine event consumer registrations
- Primary key: `engine_id`, `event_type`, `schema_version`
- Foreign keys: `engine_id -> greenfield_engine_registrations.engine_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_engine_event_consumer_registrations_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `044_greenfield_backend_v1_engine_fabric.sql`
- Routes reading: `GET /v1/admin/ops/engines`, `GET /v1/admin/ops/engines/:engineId`, `GET /v1/meta`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/engines/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_engine_job_registrations`

- Purpose: application state for greenfield engine job registrations
- Primary key: `engine_id`, `action`
- Foreign keys: `engine_id -> greenfield_engine_registrations.engine_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_engine_job_registrations_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `maximum_attempts`, `created_at`
- Migration introduced: `044_greenfield_backend_v1_engine_fabric.sql`
- Routes reading: `GET /v1/admin/ops/engines`, `GET /v1/admin/ops/engines/:engineId`, `GET /v1/meta`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/engines/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_engine_registrations`

- Purpose: application state for greenfield engine registrations
- Primary key: `engine_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_engine_registrations_package_name_key`, `greenfield_engine_registrations_pkey`
- Unique constraints: `greenfield_engine_registrations_package_name_key(package_name)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `044_greenfield_backend_v1_engine_fabric.sql`
- Routes reading: `GET /v1/admin/ops/engines`, `GET /v1/admin/ops/engines/:engineId`, `GET /v1/meta`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/engines/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_engine_service_registrations`

- Purpose: application state for greenfield engine service registrations
- Primary key: `service_id`
- Foreign keys: `engine_id -> greenfield_engine_registrations.engine_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_engine_service_registrations_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `044_greenfield_backend_v1_engine_fabric.sql`
- Routes reading: `GET /v1/admin/ops/engines`, `GET /v1/admin/ops/engines/:engineId`, `GET /v1/meta`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/engines/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_engine_usage_metric_registrations`

- Purpose: application state for greenfield engine usage metric registrations
- Primary key: `engine_id`, `metric`
- Foreign keys: `engine_id -> greenfield_engine_registrations.engine_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_engine_usage_metric_registrations_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `044_greenfield_backend_v1_engine_fabric.sql`
- Routes reading: `GET /v1/admin/ops/engines`, `GET /v1/admin/ops/engines/:engineId`, `GET /v1/meta`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/engines/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_entitlement_capabilities`

- Purpose: application state for greenfield entitlement capabilities
- Primary key: `entitlement_id`, `capability`
- Foreign keys: `entitlement_id -> greenfield_entitlements.entitlement_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_entitlement_capabilities_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `049_greenfield_backend_v1_entitlements_usage.sql`
- Routes reading: `POST /v1/admin/commerce/entitlements`, `POST /v1/admin/commerce/entitlements/:entitlementId/transitions`, `GET /v1/backend/products/:productId/accounts/:accountId/entitlements`, `POST /v1/backend/products/:productId/entitlements/check`, `GET /v1/commerce/entitlements`, `POST /v1/commerce/entitlements/check`
- Routes writing: `POST /v1/admin/commerce/entitlements`
- API/worker source reads: `services/greenfield-api/src/entitlements/service.ts`
- API/worker source writes: `services/greenfield-api/src/entitlements/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_entitlement_events`

- Purpose: application state for greenfield entitlement events
- Primary key: `entitlement_event_id`
- Foreign keys: `entitlement_id -> greenfield_entitlements.entitlement_id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `greenfield_entitlement_events_ledger_idx`, `greenfield_entitlement_events_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `occurred_at`
- Migration introduced: `049_greenfield_backend_v1_entitlements_usage.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/commerce/entitlements`, `POST /v1/admin/commerce/entitlements/:entitlementId/transitions`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/entitlements/service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_entitlements`

- Purpose: application state for greenfield entitlements
- Primary key: `entitlement_id`
- Foreign keys: `external_receipt_id -> greenfield_external_billing_receipts.receipt_id`, `offer_id -> greenfield_offers.offer_id`, `owner_account_id -> greenfield_accounts.account_id`, `owner_organisation_id -> greenfield_developer_organisations.organisation_id`
- Ownership/workspace/user/module columns: `owner_account_id`, `product_id`
- Indexes: `greenfield_entitlements_account_idx`, `greenfield_entitlements_org_idx`, `greenfield_entitlements_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `started_at`, `expires_at`, `created_at`, `updated_at`
- Migration introduced: `049_greenfield_backend_v1_entitlements_usage.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/admin/commerce/entitlements`, `POST /v1/admin/commerce/entitlements/:entitlementId/transitions`, `GET /v1/backend/products/:productId/accounts/:accountId/entitlements`, `POST /v1/backend/products/:productId/entitlements/check`, `POST /v1/backend/products/:productId/usage`, `GET /v1/commerce/entitlements`, `POST /v1/commerce/entitlements/check`, `GET /v1/gubic/games/:gameId/eligibility`, `POST /v1/gubic/games/:gameId/install-plan`, `GET /v1/gubic/my-games`, `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/install-plan`, `POST /v1/modules/:moduleId/install-preview`, `POST /v1/modules/:moduleId/package-install-plan`, `POST /v1/modules/:moduleId/update`
- Routes writing: `POST /v1/admin/commerce/entitlements`, `POST /v1/admin/commerce/entitlements/:entitlementId/transitions`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/entitlements/service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`
- API/worker source writes: `services/greenfield-api/src/entitlements/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_event_deliveries`

- Purpose: domain event delivery state
- Primary key: `delivery_id`
- Foreign keys: `event_id -> greenfield_domain_events.event_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_event_deliveries_claim_idx`, `greenfield_event_deliveries_dead_letter_idx`, `greenfield_event_deliveries_event_id_subscriber_id_key`, `greenfield_event_deliveries_event_idx`, `greenfield_event_deliveries_pkey`, `greenfield_event_deliveries_subscriber_idx`
- Unique constraints: `greenfield_event_deliveries_event_id_subscriber_id_key(event_id,subscriber_id)`
- Soft delete: none
- Timestamps: `available_at`, `lease_expires_at`, `maximum_attempts`, `delivered_at`, `created_at`, `updated_at`
- Migration introduced: `018_phase7e_internal_events.sql`
- Routes reading: `GET /v1/admin/ops/events/subscriber-failures`
- Routes writing: `POST /v1/admin/ops/events/dead-letters/retry`, `POST /v1/admin/ops/events/replay`, `POST /v1/admin/ops/events/replay/:replayId/cancel`
- API/worker source reads: `services/greenfield-api/src/domains/search/repository.ts`, `services/greenfield-api/src/events/replay.ts`, `services/greenfield-worker/src/events/claim.ts`, `services/greenfield-worker/src/search/diagnostics.ts`
- API/worker source writes: `services/greenfield-api/src/domains/search/repository.ts`, `services/greenfield-api/src/events/domain-events.ts`, `services/greenfield-api/src/events/replay.ts`, `services/greenfield-worker/src/events/claim.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_event_inbox`

- Purpose: domain event delivery state
- Primary key: `subscriber_id`, `event_id`
- Foreign keys: `event_id -> greenfield_domain_events.event_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_event_inbox_pkey`, `greenfield_event_inbox_state_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `first_received_at`, `last_attempted_at`, `completed_at`
- Migration introduced: `019_phase7e_event_platform.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-worker/src/events/inbox.ts`
- API/worker source writes: `services/greenfield-worker/src/events/inbox.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_event_replay_requests`

- Purpose: domain event delivery state
- Primary key: `replay_id`
- Foreign keys: `requested_by_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `requested_by_actor_id`
- Indexes: `greenfield_event_replay_requests_pkey`, `greenfield_event_replay_requests_state_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `completed_at`
- Migration introduced: `019_phase7e_event_platform.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/ops/events/dead-letters/retry`, `POST /v1/admin/ops/events/replay`, `POST /v1/admin/ops/events/replay/:replayId/cancel`
- API/worker source reads: `services/greenfield-api/src/events/replay.ts`
- API/worker source writes: `services/greenfield-api/src/events/replay.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_event_schema_registry`

- Purpose: domain event delivery state
- Primary key: `event_type`, `event_version`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_event_schema_registry_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `019_phase7e_event_platform.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `greenfield_event_subscriptions`

- Purpose: domain event delivery state
- Primary key: `subscription_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_event_subscriptions_event_idx`, `greenfield_event_subscriptions_event_type_subscriber_id_key`, `greenfield_event_subscriptions_pkey`
- Unique constraints: `greenfield_event_subscriptions_event_type_subscriber_id_key(event_type,subscriber_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `018_phase7e_internal_events.sql`
- Routes reading: `POST /v1/admin/ops/events/dead-letters/retry`, `POST /v1/admin/ops/events/replay`
- Routes writing: `POST /v1/extensions/:extensionProductId/capabilities/review`
- API/worker source reads: `services/greenfield-api/src/events/domain-events.ts`, `services/greenfield-api/src/events/replay.ts`, `services/greenfield-worker/src/events/runner.ts`
- API/worker source writes: `services/greenfield-api/src/events/domain-events.ts`, `services/greenfield-api/src/modules/extension-fabric-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_capabilities`

- Purpose: application state for greenfield extension capabilities
- Primary key: `capability_id`
- Foreign keys: `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `installation_id`
- Indexes: `greenfield_extension_capabilitie_installation_id_capability_key`, `greenfield_extension_capabilities_pkey`
- Unique constraints: `greenfield_extension_capabilitie_installation_id_capability_key(installation_id,capability)`
- Soft delete: none
- Timestamps: `granted_at`, `revoked_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/admin/ops/policy/evaluate`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`
- Routes writing: `POST /v1/extensions/:extensionId/install`
- API/worker source reads: `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/extensions/capability-resolver.ts`
- API/worker source writes: `services/greenfield-api/src/extensions/installation-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_capability_grants`

- Purpose: application state for greenfield extension capability grants
- Primary key: `grant_id`
- Foreign keys: `consumer_installation_id -> greenfield_extension_installations.installation_id`, `approved_by_account_id -> greenfield_accounts.account_id`, `target_installation_id -> greenfield_extension_installations.installation_id`, `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `consumer_installation_id`, `consumer_product_id`, `target_installation_id`, `target_product_id`, `approved_by_account_id`
- Indexes: `greenfield_extension_capabili_consumer_installation_id_targ_key`, `greenfield_extension_capability_grants_check_idx`, `greenfield_extension_capability_grants_pkey`
- Unique constraints: `greenfield_extension_capabili_consumer_installation_id_targ_key(consumer_installation_id,target_installation_id,capability,scope_type,scope_ref)`
- Soft delete: none
- Timestamps: `approved_at`, `revoked_at`, `created_at`, `updated_at`
- Migration introduced: `039_pvp_platform_2_extension_fabric.sql`
- Routes reading: `GET /v1/extensions/:extensionProductId/capabilities`, `POST /v1/extensions/:extensionProductId/capabilities/review`, `POST /v1/extensions/:extensionProductId/contributions/:contributionId/invoke`, `GET /v1/extensions/:extensionProductId/inspector`, `POST /v1/extensions/:extensionProductId/jobs`
- Routes writing: `POST /v1/extensions/:extensionProductId/capabilities/review`
- API/worker source reads: `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-worker/src/modules/extension-event-handler.ts`
- API/worker source writes: `services/greenfield-api/src/modules/extension-fabric-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_catalogue`

- Purpose: application state for greenfield extension catalogue
- Primary key: `extension_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_extension_catalogue_pkey`, `greenfield_extension_catalogue_slug_key`
- Unique constraints: `greenfield_extension_catalogue_slug_key(slug)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: `PATCH /v1/extensions/:extensionId/configuration`, `POST /v1/extensions/:extensionId/disable`, `POST /v1/extensions/:extensionId/enable`, `GET /v1/extensions/catalogue`, `GET /v1/registry/modules`, `GET /v1/registry/modules/:moduleId`, `GET /v1/registry/products`, `GET /v1/registry/products/:productId`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/extensions/lifecycle-service.ts`, `services/greenfield-api/src/modules/registry-service.ts`, `services/greenfield-worker/src/search/index.ts`, `services/greenfield-worker/src/search/module-projector.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_contribution_registrations`

- Purpose: application state for greenfield extension contribution registrations
- Primary key: `contribution_registration_id`
- Foreign keys: `target_installation_id -> greenfield_extension_installations.installation_id`, `installation_id -> greenfield_extension_installations.installation_id`, `account_id -> greenfield_accounts.account_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`, `extension_product_id`, `target_product_id`, `target_installation_id`
- Indexes: `greenfield_extension_contribu_installation_id_contribution__key`, `greenfield_extension_contribution_registrations_pkey`, `greenfield_extension_contributions_host_idx`
- Unique constraints: `greenfield_extension_contribu_installation_id_contribution__key(installation_id,contribution_id,target_product_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `039_pvp_platform_2_extension_fabric.sql`
- Routes reading: `POST /v1/extensions/:extensionProductId/contributions/:contributionId/fail`, `POST /v1/extensions/:extensionProductId/contributions/:contributionId/invoke`, `GET /v1/extensions/:extensionProductId/inspector`, `POST /v1/extensions/:extensionProductId/jobs`, `GET /v1/module-host/:targetProductId/composition`
- Routes writing: `POST /v1/extensions/:extensionProductId/contributions/:contributionId/fail`
- API/worker source reads: `services/greenfield-api/src/modules/extension-fabric-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-worker/src/modules/extension-fabric-projection.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_entity_metadata`

- Purpose: application state for greenfield extension entity metadata
- Primary key: `metadata_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `owner_installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `account_id`, `owner_installation_id`, `extension_product_id`, `target_product_id`
- Indexes: `greenfield_extension_entity_m_account_id_extension_product__key`, `greenfield_extension_entity_metadata_pkey`, `greenfield_extension_entity_metadata_target_idx`
- Unique constraints: `greenfield_extension_entity_m_account_id_extension_product__key(account_id,extension_product_id,entity_type,entity_id,namespace)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `039_pvp_platform_2_extension_fabric.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `greenfield_extension_event_subscriptions`

- Purpose: application state for greenfield extension event subscriptions
- Primary key: `subscription_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`, `extension_product_id`, `target_product_id`
- Indexes: `greenfield_extension_event_su_installation_id_target_produc_key`, `greenfield_extension_event_subscriptions_event_idx`, `greenfield_extension_event_subscriptions_pkey`
- Unique constraints: `greenfield_extension_event_su_installation_id_target_produc_key(installation_id,target_product_id,event_type)`
- Soft delete: none
- Timestamps: `last_delivery_at`, `created_at`, `updated_at`
- Migration introduced: `039_pvp_platform_2_extension_fabric.sql`
- Routes reading: `POST /v1/extensions/:extensionProductId/capabilities/review`
- Routes writing: `POST /v1/extensions/:extensionProductId/capabilities/review`
- API/worker source reads: `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-worker/src/modules/extension-event-handler.ts`
- API/worker source writes: `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-worker/src/modules/extension-event-handler.ts`, `services/greenfield-worker/src/modules/extension-fabric-projection.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_failures`

- Purpose: application state for greenfield extension failures
- Primary key: `failure_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`
- Indexes: `greenfield_extension_failures_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/extensions/lifecycle-service.ts`, `services/greenfield-worker/src/extensions/plugin-lifecycle.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_extension_installation_edges`

- Purpose: application state for greenfield extension installation edges
- Primary key: `edge_id`
- Foreign keys: `source_installation_id -> greenfield_extension_installations.installation_id`, `target_installation_id -> greenfield_extension_installations.installation_id`, `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `source_installation_id`, `source_product_id`, `target_installation_id`, `target_product_id`
- Indexes: `greenfield_extension_installa_source_installation_id_target_key`, `greenfield_extension_installation_edges_pkey`, `greenfield_extension_installation_edges_target_idx`
- Unique constraints: `greenfield_extension_installa_source_installation_id_target_key(source_installation_id,target_installation_id,relation)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `039_pvp_platform_2_extension_fabric.sql`
- Routes reading: `GET /v1/extensions/:extensionProductId/inspector`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/extension-fabric-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-worker/src/modules/extension-fabric-projection.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_installations`

- Purpose: application state for greenfield extension installations
- Primary key: `installation_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `extension_version_id -> greenfield_extension_versions.extension_version_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`
- Indexes: `greenfield_extension_installations_account_version_idx`, `greenfield_extension_installations_pkey`, `greenfield_extension_installations_standard_version_account_uid`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/admin/ops/policy/evaluate`, `GET /v1/attachments/:attachmentId/content`, `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `POST /v1/extensions/:extensionId/disable`, `POST /v1/extensions/:extensionId/enable`, `DELETE /v1/extensions/:extensionId/install`, `PATCH /v1/extensions/:extensionId/preferences`, `POST /v1/extensions/:extensionProductId/contributions/:contributionId/invoke`, `GET /v1/extensions/installed`, `GET /v1/functions`, `GET /v1/module-host/:targetProductId/composition`, `POST /v1/modules/:moduleId/ai/requests`, `GET /v1/modules/:moduleId/backend`, `POST /v1/modules/:moduleId/backend/disable`, `POST /v1/modules/:moduleId/backend/discover`, `POST /v1/modules/:moduleId/backend/health`, `POST /v1/modules/:moduleId/disable`, `POST /v1/modules/:moduleId/enable`, `POST /v1/modules/:moduleId/install`, `GET /v1/modules/:moduleId/install-descriptor`, `GET /v1/modules/:moduleId/installation-descriptor`, `POST /v1/modules/:moduleId/permissions/review`, `DELETE /v1/modules/:moduleId/record-shares/:shareId`, `PATCH /v1/modules/:moduleId/record-shares/:shareId`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection/:recordId/media`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PUT /v1/modules/:moduleId/records/:collection/:recordId/media/order`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`, `POST /v1/modules/:moduleId/records/:collection/:recordId/shares`, `POST /v1/modules/:moduleId/rollback`, `GET /v1/modules/:moduleId/runtime`, `POST /v1/modules/:moduleId/services/:serviceId/invoke`, `POST /v1/modules/:moduleId/update-plan`, `GET /v1/modules/contributions`, `PATCH /v1/modules/installations/:installationId/update-policy`, `GET /v1/modules/installed`, `GET /v1/modules/installed/:moduleId`, `GET /v1/modules/updates`, `GET /v1/providers/:capabilityRole`, `PUT /v1/providers/:capabilityRole/default`, `GET /v1/providers/:capabilityRole/resolve`
- Routes writing: `POST /v1/extensions/:extensionId/disable`, `POST /v1/extensions/:extensionId/enable`, `DELETE /v1/extensions/:extensionId/install`, `POST /v1/extensions/:extensionId/install`, `PATCH /v1/extensions/:extensionId/preferences`, `POST /v1/modules/:moduleId/disable`, `POST /v1/modules/:moduleId/enable`, `POST /v1/modules/:moduleId/install`, `PATCH /v1/modules/installations/:installationId/update-policy`
- API/worker source reads: `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/extensions/capability-resolver.ts`, `services/greenfield-api/src/extensions/installation-service.ts`, `services/greenfield-api/src/extensions/lifecycle-service.ts`, `services/greenfield-api/src/functions/service.ts`, `services/greenfield-api/src/intelligence/action-boundary.ts`, `services/greenfield-api/src/modules/contribution-service.ts`, `services/greenfield-api/src/modules/dependency-resolver.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-api/src/modules/identity-migration-service.ts`, `services/greenfield-api/src/modules/installation-service.ts`, `services/greenfield-api/src/modules/legacy-upgrade-progress.ts`, `services/greenfield-api/src/modules/marketplace-service.ts`, `services/greenfield-api/src/modules/media-binding-service.ts`, `services/greenfield-api/src/modules/permission-reconciliation-service.ts`, `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-api/src/modules/record-sharing-service.ts`, `services/greenfield-api/src/modules/runtime-access.ts`, `services/greenfield-api/src/modules/runtime2-service.ts`, `services/greenfield-api/src/providers/service.ts`, `services/greenfield-worker/src/extensions/plugin-lifecycle.ts`, `services/greenfield-worker/src/modules/disable-handler.ts`, `services/greenfield-worker/src/modules/enable-handler.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts`, `services/greenfield-worker/src/modules/update-handler.ts`
- API/worker source writes: `services/greenfield-api/src/extensions/installation-service.ts`, `services/greenfield-api/src/extensions/lifecycle-service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/identity-migration-service.ts`, `services/greenfield-api/src/modules/installation-service.ts`, `services/greenfield-worker/src/extensions/plugin-lifecycle.ts`, `services/greenfield-worker/src/modules/disable-handler.ts`, `services/greenfield-worker/src/modules/enable-handler.ts`, `services/greenfield-worker/src/modules/installation-handler.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts`, `services/greenfield-worker/src/modules/update-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_job_executions`

- Purpose: application state for greenfield extension job executions
- Primary key: `execution_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `job_registration_id -> greenfield_module_job_registrations.job_registration_id`, `owner_installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `account_id`, `owner_installation_id`, `extension_product_id`, `target_product_id`
- Indexes: `greenfield_extension_job_exec_owner_installation_id_idempot_key`, `greenfield_extension_job_executions_pkey`, `greenfield_extension_job_executions_queue_idx`
- Unique constraints: `greenfield_extension_job_exec_owner_installation_id_idempot_key(owner_installation_id,idempotency_key)`
- Soft delete: none
- Timestamps: `maximum_attempts`, `available_at`, `started_at`, `completed_at`, `created_at`, `updated_at`
- Migration introduced: `039_pvp_platform_2_extension_fabric.sql`
- Routes reading: `GET /v1/extensions/:extensionProductId/inspector`, `POST /v1/extensions/:extensionProductId/jobs`
- Routes writing: `POST /v1/extensions/:extensionProductId/jobs`
- API/worker source reads: `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-worker/src/modules/extension-job-handler.ts`
- API/worker source writes: `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-worker/src/modules/extension-event-handler.ts`, `services/greenfield-worker/src/modules/extension-job-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_lifecycle_events`

- Purpose: application state for greenfield extension lifecycle events
- Primary key: `event_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_extension_lifecycle_events_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: none observed
- Routes writing: `PATCH /v1/extensions/:extensionId/configuration`, `POST /v1/extensions/:extensionId/disable`, `POST /v1/extensions/:extensionId/enable`, `POST /v1/modules/:moduleId/disable`, `POST /v1/modules/:moduleId/enable`, `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/permissions/review`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/extensions/lifecycle-service.ts`, `services/greenfield-api/src/modules/installation-service.ts`, `services/greenfield-worker/src/extensions/plugin-lifecycle.ts`, `services/greenfield-worker/src/modules/extension-fabric-projection.ts`, `services/greenfield-worker/src/modules/installation-handler.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_extension_points`

- Purpose: application state for greenfield extension points
- Primary key: `extension_point_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `product_id`
- Indexes: `greenfield_extension_points_pkey`, `greenfield_extension_points_product_idx`, `greenfield_extension_points_release_id_point_key_key`
- Unique constraints: `greenfield_extension_points_release_id_point_key_key(release_id,point_key)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `039_pvp_platform_2_extension_fabric.sql`
- Routes reading: `GET /v1/module-host/:targetProductId/composition`
- Routes writing: `POST /v1/admin/registry/modules/import`
- API/worker source reads: `services/greenfield-api/src/modules/extension-fabric-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_runtime_projection`

- Purpose: application state for greenfield extension runtime projection
- Primary key: `installation_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `product_id`
- Indexes: `greenfield_extension_runtime_projecti_account_id_product_id_key`, `greenfield_extension_runtime_projection_host_idx`, `greenfield_extension_runtime_projection_pkey`
- Unique constraints: `greenfield_extension_runtime_projecti_account_id_product_id_key(account_id,product_id)`
- Soft delete: none
- Timestamps: `projected_at`, `updated_at`
- Migration introduced: `039_pvp_platform_2_extension_fabric.sql`
- Routes reading: `GET /v1/extensions/:extensionProductId/capabilities`, `POST /v1/extensions/:extensionProductId/capabilities/review`, `POST /v1/extensions/:extensionProductId/contributions/:contributionId/invoke`, `GET /v1/extensions/:extensionProductId/inspector`, `POST /v1/extensions/:extensionProductId/jobs`, `GET /v1/module-host/:targetProductId/composition`, `POST /v1/modules/:moduleId/disable`, `POST /v1/modules/:moduleId/enable`, `POST /v1/modules/:moduleId/install`, `GET /v1/modules/:moduleId/install-descriptor`, `POST /v1/modules/:moduleId/permissions/review`, `GET /v1/modules/installed`, `GET /v1/modules/installed/:moduleId`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-api/src/modules/installation-service.ts`, `services/greenfield-worker/src/modules/extension-event-handler.ts`
- API/worker source writes: `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-worker/src/modules/extension-fabric-projection.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_service_assertions`

- Purpose: application state for greenfield extension service assertions
- Primary key: `assertion_id`
- Foreign keys: `consumer_installation_id -> greenfield_extension_installations.installation_id`, `target_installation_id -> greenfield_extension_installations.installation_id`, `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `consumer_installation_id`, `consumer_product_id`, `target_installation_id`, `target_product_id`
- Indexes: `greenfield_extension_service_assertions_active_idx`, `greenfield_extension_service_assertions_jti_key`, `greenfield_extension_service_assertions_pkey`, `greenfield_extension_service_assertions_token_hash_key`
- Unique constraints: `greenfield_extension_service_assertions_jti_key(jti)`, `greenfield_extension_service_assertions_token_hash_key(token_hash)`
- Soft delete: none
- Timestamps: `issued_at`, `expires_at`, `consumed_at`, `revoked_at`, `created_at`
- Migration introduced: `039_pvp_platform_2_extension_fabric.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/backend/token-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/backend/token-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_targets`

- Purpose: application state for greenfield extension targets
- Primary key: `target_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `product_id`, `target_product_id`
- Indexes: `greenfield_extension_targets_pkey`, `greenfield_extension_targets_release_id_target_product_id_key`, `greenfield_extension_targets_target_idx`
- Unique constraints: `greenfield_extension_targets_release_id_target_product_id_key(release_id,target_product_id)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `039_pvp_platform_2_extension_fabric.sql`
- Routes reading: `GET /v1/registry/products/:productId/relationships`
- Routes writing: `POST /v1/admin/registry/modules/import`
- API/worker source reads: `services/greenfield-api/src/modules/dependency-resolver.ts`, `services/greenfield-api/src/modules/extension-fabric-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extension_versions`

- Purpose: application state for greenfield extension versions
- Primary key: `extension_version_id`
- Foreign keys: `extension_id -> greenfield_extensions.extension_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_extension_versions_extension_id_version_key`, `greenfield_extension_versions_pkey`
- Unique constraints: `greenfield_extension_versions_extension_id_version_key(extension_id,version)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/admin/ops/policy/evaluate`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `GET /v1/extensions`, `GET /v1/extensions/:extensionId`, `POST /v1/extensions/:extensionId/disable`, `POST /v1/extensions/:extensionId/enable`, `DELETE /v1/extensions/:extensionId/install`, `POST /v1/extensions/:extensionId/install`, `PATCH /v1/extensions/:extensionId/preferences`, `GET /v1/extensions/installed`, `GET /v1/modules`
- Routes writing: `POST /v1/admin/registry/modules/import`
- API/worker source reads: `services/greenfield-api/src/app/register-routes.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/extensions/extension-registry.ts`, `services/greenfield-api/src/extensions/installation-service.ts`, `services/greenfield-api/src/extensions/lifecycle-service.ts`, `services/greenfield-worker/src/extensions/plugin-lifecycle.ts`, `services/greenfield-worker/src/modules/installation-handler.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_extensions`

- Purpose: application state for greenfield extensions
- Primary key: `extension_id`
- Foreign keys: `publisher_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `publisher_account_id`
- Indexes: `greenfield_extensions_pkey`, `greenfield_extensions_slug_key`
- Unique constraints: `greenfield_extensions_slug_key(slug)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/admin/ops/policy/evaluate`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `GET /v1/extensions`, `GET /v1/extensions/:extensionId`, `POST /v1/extensions/:extensionId/disable`, `POST /v1/extensions/:extensionId/enable`, `DELETE /v1/extensions/:extensionId/install`, `POST /v1/extensions/:extensionId/install`, `PATCH /v1/extensions/:extensionId/preferences`, `GET /v1/extensions/installed`, `GET /v1/modules`
- Routes writing: `POST /v1/admin/registry/modules/import`
- API/worker source reads: `services/greenfield-api/src/app/register-routes.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/extensions/extension-registry.ts`, `services/greenfield-api/src/extensions/installation-service.ts`, `services/greenfield-api/src/extensions/lifecycle-service.ts`, `services/greenfield-worker/src/extensions/plugin-lifecycle.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_external_billing_receipts`

- Purpose: application state for greenfield external billing receipts
- Primary key: `receipt_id`
- Foreign keys: `adapter -> greenfield_billing_adapter_registrations.adapter`, `offer_id -> greenfield_offers.offer_id`, `owner_account_id -> greenfield_accounts.account_id`, `owner_organisation_id -> greenfield_developer_organisations.organisation_id`
- Ownership/workspace/user/module columns: `owner_account_id`, `product_id`
- Indexes: `greenfield_external_billing_r_adapter_external_transaction__key`, `greenfield_external_billing_receipts_pkey`
- Unique constraints: `greenfield_external_billing_r_adapter_external_transaction__key(adapter,external_transaction_id)`
- Soft delete: none
- Timestamps: `observed_at`, `created_at`
- Migration introduced: `049_greenfield_backend_v1_entitlements_usage.sql`
- Routes reading: `POST /v1/admin/commerce/entitlements`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/entitlements/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_external_identities`

- Purpose: application state for greenfield external identities
- Primary key: `external_identity_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `method_id -> greenfield_authentication_methods.method_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_external_identities_account_idx`, `greenfield_external_identities_pkey`, `greenfield_external_identities_provider_subject_unique`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `linked_at`, `last_used_at`, `revoked_at`
- Migration introduced: `031_phase7i_f5_auth_domain.sql`
- Routes reading: `POST /v1/auth/apple/link`, `POST /v1/sessions/apple`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/auth/apple/link`, `POST /v1/sessions/apple`
- API/worker source reads: `services/greenfield-api/src/auth/apple/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/auth/apple/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_function_implementations`

- Purpose: application state for greenfield function implementations
- Primary key: `implementation_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_function_implement_release_id_function_id_functi_key`, `greenfield_function_implementations_pkey`
- Unique constraints: `greenfield_function_implement_release_id_function_id_functi_key(release_id,function_id,function_version,execution_mode)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `070_module_platform_functions_actions.sql`
- Routes reading: `POST /v1/modules/:moduleId/functions/:functionId/:version/invoke`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/governed-function-service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_function_invocations`

- Purpose: application state for greenfield function invocations
- Primary key: `invocation_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`, `module_id`
- Indexes: `greenfield_function_invocatio_account_id_installation_id_fu_key`, `greenfield_function_invocations_ledger_idx`, `greenfield_function_invocations_pkey`
- Unique constraints: `greenfield_function_invocatio_account_id_installation_id_fu_key(account_id,installation_id,function_id,function_version,request_identity)`
- Soft delete: none
- Timestamps: `created_at`, `completed_at`
- Migration introduced: `070_module_platform_functions_actions.sql`
- Routes reading: `POST /v1/modules/:moduleId/host-function-requests/:requestId/complete`
- Routes writing: `POST /v1/modules/:moduleId/functions/:functionId/:version/invoke`, `GET /v1/modules/:moduleId/host-function-executors/:executorId/requests`, `GET /v1/modules/:moduleId/host-function-requests/:requestId`, `POST /v1/modules/:moduleId/host-function-requests/:requestId/cancel`, `POST /v1/modules/:moduleId/host-function-requests/:requestId/complete`
- API/worker source reads: `services/greenfield-api/src/modules/governed-function-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/governed-function-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_function_jobs`

- Purpose: application state for greenfield function jobs
- Primary key: `job_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `function_id -> greenfield_functions.function_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_function_jobs_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `started_at`, `completed_at`, `expires_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: `GET /v1/function-jobs/:jobId`, `POST /v1/function-jobs/:jobId/cancel`
- Routes writing: `POST /v1/function-jobs/:jobId/cancel`, `POST /v1/functions/:functionId/jobs`
- API/worker source reads: `services/greenfield-api/src/functions/job-service.ts`, `services/greenfield-worker/src/functions/invoke.ts`
- API/worker source writes: `services/greenfield-api/src/functions/job-service.ts`, `services/greenfield-worker/src/functions/invoke.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_function_mutations`

- Purpose: application state for greenfield function mutations
- Primary key: `mutation_row_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`
- Indexes: `greenfield_function_mutations_account_id_installation_id_fu_key`, `greenfield_function_mutations_pkey`
- Unique constraints: `greenfield_function_mutations_account_id_installation_id_fu_key(account_id,installation_id,function_id,function_version,mutation_id)`
- Soft delete: none
- Timestamps: `created_at`, `completed_at`
- Migration introduced: `070_module_platform_functions_actions.sql`
- Routes reading: `POST /v1/modules/:moduleId/functions/:functionId/:version/invoke`
- Routes writing: `POST /v1/modules/:moduleId/functions/:functionId/:version/invoke`, `POST /v1/modules/:moduleId/host-function-requests/:requestId/complete`
- API/worker source reads: `services/greenfield-api/src/modules/governed-function-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/governed-function-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_functions`

- Purpose: application state for greenfield functions
- Primary key: `function_id`
- Foreign keys: `extension_version_id -> greenfield_extension_versions.extension_version_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_functions_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `GET /v1/functions`, `POST /v1/functions/:functionId/invoke`, `POST /v1/functions/:functionId/jobs`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/functions/job-service.ts`, `services/greenfield-api/src/functions/service.ts`
- API/worker source writes: `services/greenfield-worker/src/modules/contribution-registration-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_game_catalogue_entries`

- Purpose: application state for greenfield game catalogue entries
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `078_gubic_game_catalogue.sql`
- Routes reading: `POST /v1/admin/gubic/games/:gameId/review`, `PUT /v1/developer/gubic/games/:gameId`, `GET /v1/gubic/categories`, `GET /v1/gubic/featured`, `GET /v1/gubic/games`, `GET /v1/gubic/games/:gameId`, `GET /v1/gubic/games/:gameId/eligibility`, `POST /v1/gubic/games/:gameId/install-plan`, `GET /v1/gubic/games/:gameId/versions`, `GET /v1/gubic/my-games`, `GET /v1/gubic/new-releases`, `GET /v1/gubic/publishers/:publisherId`, `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/install-plan`, `POST /v1/modules/:moduleId/install-preview`, `POST /v1/modules/:moduleId/package-install-plan`
- Routes writing: `POST /v1/admin/gubic/games/:gameId/review`, `PUT /v1/developer/gubic/games/:gameId`, `POST /v1/developer/gubic/submissions`
- API/worker source reads: `services/greenfield-api/src/modules/gubic-service.ts`
- API/worker source writes: `services/greenfield-api/src/gubic/play-service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_game_catalogue_events`

- Purpose: application state for greenfield game catalogue events
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `078_gubic_game_catalogue.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/gubic/games/:gameId/review`, `PUT /v1/developer/gubic/games/:gameId`, `POST /v1/developer/gubic/submissions`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/gubic/play-service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_gubic_achievement_unlocks`

- Purpose: application state for greenfield gubic achievement unlocks
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `082_gubic_play_platform.sql`
- Routes reading: `GET /v1/gubic/games/:gameId/achievements`, `GET /v1/gubic/library`, `PUT /v1/gubic/library/:gameId`, `GET /v1/gubic/me/achievements`, `POST /v1/gubic/sessions/:sessionId/achievements/:key`
- Routes writing: `POST /v1/gubic/sessions/:sessionId/achievements/:key`
- API/worker source reads: `services/greenfield-api/src/gubic/play-service.ts`
- API/worker source writes: `services/greenfield-api/src/gubic/play-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_gubic_achievements`

- Purpose: application state for greenfield gubic achievements
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `082_gubic_play_platform.sql`
- Routes reading: `GET /v1/gubic/games/:gameId/achievements`, `GET /v1/gubic/me/achievements`, `POST /v1/gubic/sessions/:sessionId/achievements/:key`
- Routes writing: `POST /v1/admin/gubic/submissions/:submissionId/decision`
- API/worker source reads: `services/greenfield-api/src/gubic/play-service.ts`
- API/worker source writes: `services/greenfield-api/src/gubic/play-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_gubic_library_items`

- Purpose: application state for greenfield gubic library items
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `082_gubic_play_platform.sql`
- Routes reading: `GET /v1/gubic/library`, `PUT /v1/gubic/library/:gameId`
- Routes writing: `POST /v1/gubic/games/:gameId/sessions`, `DELETE /v1/gubic/library/:gameId`, `PUT /v1/gubic/library/:gameId`, `POST /v1/gubic/sessions/:sessionId/end`
- API/worker source reads: `services/greenfield-api/src/gubic/play-service.ts`
- API/worker source writes: `services/greenfield-api/src/gubic/play-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_gubic_lobbies`

- Purpose: application state for greenfield gubic lobbies
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `082_gubic_play_platform.sql`
- Routes reading: `GET /v1/gubic/games/:gameId/lobbies`, `POST /v1/gubic/games/:gameId/lobbies`, `GET /v1/gubic/lobbies/:lobbyId`, `POST /v1/gubic/lobbies/:lobbyId/join`, `POST /v1/gubic/lobbies/:lobbyId/leave`, `POST /v1/gubic/lobbies/:lobbyId/ready`, `POST /v1/gubic/lobbies/:lobbyId/start`, `POST /v1/gubic/lobbies/join`
- Routes writing: `POST /v1/gubic/games/:gameId/lobbies`, `POST /v1/gubic/lobbies/:lobbyId/join`, `POST /v1/gubic/lobbies/:lobbyId/leave`, `POST /v1/gubic/lobbies/:lobbyId/ready`, `POST /v1/gubic/lobbies/:lobbyId/start`, `POST /v1/gubic/lobbies/join`
- API/worker source reads: `services/greenfield-api/src/gubic/play-service.ts`
- API/worker source writes: `services/greenfield-api/src/gubic/play-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_gubic_lobby_members`

- Purpose: application state for greenfield gubic lobby members
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `082_gubic_play_platform.sql`
- Routes reading: `GET /v1/gubic/games/:gameId/lobbies`, `POST /v1/gubic/games/:gameId/lobbies`, `POST /v1/gubic/games/:gameId/sessions`, `GET /v1/gubic/lobbies/:lobbyId`, `POST /v1/gubic/lobbies/:lobbyId/join`, `POST /v1/gubic/lobbies/:lobbyId/leave`, `POST /v1/gubic/lobbies/:lobbyId/ready`, `GET /v1/gubic/lobbies/:lobbyId/socket`, `POST /v1/gubic/lobbies/:lobbyId/start`, `POST /v1/gubic/lobbies/join`
- Routes writing: `POST /v1/gubic/games/:gameId/lobbies`, `POST /v1/gubic/lobbies/:lobbyId/join`, `POST /v1/gubic/lobbies/:lobbyId/leave`, `POST /v1/gubic/lobbies/:lobbyId/ready`, `POST /v1/gubic/lobbies/join`
- API/worker source reads: `services/greenfield-api/src/gubic/play-service.ts`
- API/worker source writes: `services/greenfield-api/src/gubic/play-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_gubic_play_sessions`

- Purpose: application state for greenfield gubic play sessions
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `082_gubic_play_platform.sql`
- Routes reading: `POST /v1/gubic/games/:gameId/sessions`, `DELETE /v1/gubic/library/:gameId`, `POST /v1/gubic/sessions/:sessionId/achievements/:key`, `POST /v1/gubic/sessions/:sessionId/end`, `POST /v1/gubic/sessions/:sessionId/heartbeat`
- Routes writing: `POST /v1/gubic/games/:gameId/sessions`, `POST /v1/gubic/sessions/:sessionId/end`, `POST /v1/gubic/sessions/:sessionId/heartbeat`
- API/worker source reads: `services/greenfield-api/src/gubic/play-service.ts`
- API/worker source writes: `services/greenfield-api/src/gubic/play-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_gubic_submissions`

- Purpose: application state for greenfield gubic submissions
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `082_gubic_play_platform.sql`
- Routes reading: `GET /v1/admin/gubic/submissions`, `POST /v1/admin/gubic/submissions/:submissionId/decision`, `GET /v1/developer/gubic/submissions`, `POST /v1/developer/gubic/submissions`, `POST /v1/developer/gubic/submissions/:submissionId/withdraw`
- Routes writing: `POST /v1/admin/gubic/submissions/:submissionId/decision`, `POST /v1/developer/gubic/submissions`, `POST /v1/developer/gubic/submissions/:submissionId/withdraw`
- API/worker source reads: `services/greenfield-api/src/gubic/play-service.ts`
- API/worker source writes: `services/greenfield-api/src/gubic/play-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_handle_history`

- Purpose: application state for greenfield handle history
- Primary key: `history_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_handle_history_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `GET /v1/accounts/:accountId/handle-history`
- Routes writing: `POST /v1/accounts/me/handle`, `POST /v1/accounts/register`, `PATCH /v1/profiles/me`
- API/worker source reads: `services/greenfield-api/src/accounts/service.ts`
- API/worker source writes: `services/greenfield-api/src/accounts/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_handles`

- Purpose: application state for greenfield handles
- Primary key: `handle`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_handles_account_idx`, `greenfield_handles_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/comments/:commentId/replies`, `POST /v1/posts/:postId/comments`, `POST /v1/posts/:postId/quote`
- Routes writing: `POST /v1/accounts/me/handle`, `POST /v1/accounts/register`, `PATCH /v1/profiles/me`
- API/worker source reads: `services/greenfield-api/src/accounts/handle.ts`, `services/greenfield-api/src/domains/mentions/service.ts`
- API/worker source writes: `services/greenfield-api/src/accounts/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_host_function_executors`

- Purpose: application state for greenfield host function executors
- Primary key: `executor_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`
- Indexes: `greenfield_host_function_executors_available_idx`, `greenfield_host_function_executors_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `expires_at`, `created_at`, `updated_at`
- Migration introduced: `070_module_platform_functions_actions.sql`
- Routes reading: `POST /v1/modules/:moduleId/functions/:functionId/:version/invoke`, `GET /v1/modules/:moduleId/host-function-executors/:executorId/requests`
- Routes writing: `POST /v1/modules/:moduleId/host-function-executors`
- API/worker source reads: `services/greenfield-api/src/modules/governed-function-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/governed-function-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_host_function_requests`

- Purpose: application state for greenfield host function requests
- Primary key: `request_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `executor_id -> greenfield_host_function_executors.executor_id`, `invocation_id -> greenfield_function_invocations.invocation_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`, `module_id`
- Indexes: `greenfield_host_function_requests_dispatch_idx`, `greenfield_host_function_requests_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `deadline_at`, `created_at`, `updated_at`, `completed_at`
- Migration introduced: `070_module_platform_functions_actions.sql`
- Routes reading: `GET /v1/modules/:moduleId/host-function-executors/:executorId/requests`, `GET /v1/modules/:moduleId/host-function-requests/:requestId`, `POST /v1/modules/:moduleId/host-function-requests/:requestId/cancel`, `POST /v1/modules/:moduleId/host-function-requests/:requestId/complete`
- Routes writing: `POST /v1/modules/:moduleId/functions/:functionId/:version/invoke`, `GET /v1/modules/:moduleId/host-function-executors/:executorId/requests`, `GET /v1/modules/:moduleId/host-function-requests/:requestId`, `POST /v1/modules/:moduleId/host-function-requests/:requestId/cancel`, `POST /v1/modules/:moduleId/host-function-requests/:requestId/complete`
- API/worker source reads: `services/greenfield-api/src/modules/governed-function-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/governed-function-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_inter_module_action_requests`

- Purpose: application state for greenfield inter module action requests
- Primary key: `request_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `source_installation_id`, `source_module_id`, `target_installation_id`, `target_module_id`
- Indexes: `greenfield_inter_module_actio_account_id_source_installatio_key`, `greenfield_inter_module_action_requests_ledger_idx`, `greenfield_inter_module_action_requests_pkey`
- Unique constraints: `greenfield_inter_module_actio_account_id_source_installatio_key(account_id,source_installation_id,target_installation_id,action_id,action_version,mutation_id)`
- Soft delete: none
- Timestamps: `created_at`, `completed_at`
- Migration introduced: `070_module_platform_functions_actions.sql`
- Routes reading: `POST /v1/module-runtime/actions/:targetModuleId/:actionId/:version`
- Routes writing: `POST /v1/module-runtime/actions/:targetModuleId/:actionId/:version`
- API/worker source reads: `services/greenfield-api/src/modules/inter-module-action-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/inter-module-action-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_link_blocklist`

- Purpose: application state for greenfield link blocklist
- Primary key: `domain`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_link_blocklist_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `065_comments_rich.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/link-previews/safety.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_link_previews`

- Purpose: application state for greenfield link previews
- Primary key: `url_hash`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_link_previews_fetched_idx`, `greenfield_link_previews_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `fetched_at`
- Migration introduced: `064_comment_media_link_previews.sql`
- Routes reading: `GET /v1/link-previews`
- Routes writing: `GET /v1/link-previews`
- API/worker source reads: `services/greenfield-api/src/domains/link-previews/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/link-previews/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_mail_identities`

- Purpose: mail identity/delivery state
- Primary key: `mail_identity_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `contact_identity_id -> greenfield_auth_identities.identity_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_mail_identities_account_active_unique`, `greenfield_mail_identities_address_active_unique`, `greenfield_mail_identities_pkey`, `greenfield_mail_identities_state_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `adopted_at`, `provisioned_at`, `activated_at`, `suspended_at`, `resumed_at`, `released_at`, `failed_at`, `created_at`, `updated_at`
- Migration introduced: `034_phase7i_f5b_mail_identity.sql`
- Routes reading: `GET /v1/accounts/mail-local-parts/:localPart/availability`, `GET /v1/accounts/me/modula-mail`, `POST /v1/accounts/me/modula-mail/forwarding`, `POST /v1/accounts/me/modula-mail/provision`, `POST /v1/admin/ops/mail/identities/adopt`
- Routes writing: `POST /v1/accounts/me/modula-mail/forwarding`, `POST /v1/accounts/me/modula-mail/provision`, `POST /v1/admin/ops/mail/identities/adopt`
- API/worker source reads: `services/greenfield-api/src/mail/identity-service.ts`, `services/greenfield-worker/src/mail/provisioner.ts`
- API/worker source writes: `services/greenfield-api/src/mail/identity-service.ts`, `services/greenfield-worker/src/mail/provisioner.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_mail_identity_events`

- Purpose: mail identity/delivery state
- Primary key: `event_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `actor_account_id -> greenfield_accounts.account_id`, `mail_identity_id -> greenfield_mail_identities.mail_identity_id`
- Ownership/workspace/user/module columns: `account_id`, `actor_account_id`
- Indexes: `greenfield_mail_identity_events_account_idx`, `greenfield_mail_identity_events_identity_idx`, `greenfield_mail_identity_events_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `034_phase7i_f5b_mail_identity.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/accounts/me/modula-mail/forwarding`, `POST /v1/accounts/me/modula-mail/provision`, `POST /v1/admin/ops/mail/identities/adopt`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/mail/identity-service.ts`, `services/greenfield-worker/src/mail/provisioner.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_mail_identity_requests`

- Purpose: mail identity/delivery state
- Primary key: `request_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `mail_identity_id -> greenfield_mail_identities.mail_identity_id`, `requested_by_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `requested_by_account_id`
- Indexes: `greenfield_mail_identity_requests_idempotency_key_key`, `greenfield_mail_identity_requests_identity_idx`, `greenfield_mail_identity_requests_pkey`, `greenfield_mail_identity_requests_state_idx`
- Unique constraints: `greenfield_mail_identity_requests_idempotency_key_key(idempotency_key)`
- Soft delete: none
- Timestamps: `maximum_attempts`, `created_at`, `updated_at`, `completed_at`, `failed_at`
- Migration introduced: `034_phase7i_f5b_mail_identity.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/accounts/me/modula-mail/forwarding`, `POST /v1/accounts/me/modula-mail/provision`
- API/worker source reads: `services/greenfield-worker/src/mail/provisioner.ts`
- API/worker source writes: `services/greenfield-api/src/mail/identity-service.ts`, `services/greenfield-worker/src/mail/provisioner.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_mail_jobs`

- Purpose: mail identity/delivery state
- Primary key: `mail_job_id`
- Foreign keys: `recipient_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `recipient_account_id`
- Indexes: `greenfield_mail_jobs_correlation_idx`, `greenfield_mail_jobs_pkey`, `greenfield_mail_jobs_recipient_account_idx`, `greenfield_mail_jobs_status_available_idx`, `greenfield_mail_jobs_template_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `maximum_attempts`, `available_at`, `queued_at`, `sending_at`, `sent_at`, `failed_at`, `dead_lettered_at`, `created_at`, `updated_at`
- Migration introduced: `029_phase7h_mail.sql`
- Routes reading: `GET /v1/admin/ops/mail/summary`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/system/status.ts`, `services/greenfield-api/src/mail/service.ts`, `services/greenfield-worker/src/mail/handler.ts`
- API/worker source writes: `services/greenfield-api/src/mail/service.ts`, `services/greenfield-worker/src/digests/digests.ts`, `services/greenfield-worker/src/mail/handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_mailbox_credentials`

- Purpose: application state for greenfield mailbox credentials
- Primary key: `credential_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `mail_identity_id -> greenfield_mail_identities.mail_identity_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_mailbox_credentials_active_unique`, `greenfield_mailbox_credentials_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `rotated_at`, `revoked_at`
- Migration introduced: `034_phase7i_f5b_mail_identity.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-worker/src/mail/provisioner.ts`
- API/worker source writes: `services/greenfield-worker/src/mail/provisioner.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_mentions`

- Purpose: application state for greenfield mentions
- Primary key: `mention_id`
- Foreign keys: `mentioned_account_id -> greenfield_accounts.account_id`, `mentioned_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `mentioned_account_id`, `mentioned_actor_id`
- Indexes: `greenfield_mentions_account_idx`, `greenfield_mentions_pkey`, `greenfield_mentions_source_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `handle_at_mention`, `created_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: `POST /v1/comments/:commentId/replies`, `POST /v1/posts/:postId/comments`, `POST /v1/posts/:postId/quote`
- Routes writing: `POST /v1/comments/:commentId/replies`, `POST /v1/posts/:postId/comments`, `POST /v1/posts/:postId/quote`
- API/worker source reads: `services/greenfield-api/src/domains/mentions/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/mentions/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_message_attachments`

- Purpose: application state for greenfield message attachments
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `089_messaging_v3.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages`, `PATCH /v1/conversations/:id/messages/:messageId`, `DELETE /v1/conversations/:id/messages/:messageId/reactions`, `PUT /v1/conversations/:id/messages/:messageId/reactions`
- Routes writing: `POST /v1/conversations/:id/messages`, `POST /v1/in-mail/:id/replies`
- API/worker source reads: `services/greenfield-api/src/domains/messaging/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/messaging/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_message_mentions`

- Purpose: application state for greenfield message mentions
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `089_messaging_v3.sql`
- Routes reading: `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages`, `PATCH /v1/conversations/:id/messages/:messageId`, `DELETE /v1/conversations/:id/messages/:messageId/reactions`, `PUT /v1/conversations/:id/messages/:messageId/reactions`
- Routes writing: `POST /v1/conversations/:id/messages`, `POST /v1/in-mail/:id/replies`
- API/worker source reads: `services/greenfield-api/src/domains/messaging/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/messaging/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_message_reactions`

- Purpose: application state for greenfield message reactions
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `081_messaging_v2.sql`
- Routes reading: `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages`, `PATCH /v1/conversations/:id/messages/:messageId`, `DELETE /v1/conversations/:id/messages/:messageId/reactions`, `GET /v1/conversations/:id/messages/:messageId/reactions`, `PUT /v1/conversations/:id/messages/:messageId/reactions`
- Routes writing: `DELETE /v1/conversations/:id/messages/:messageId`, `DELETE /v1/conversations/:id/messages/:messageId/reactions`, `PUT /v1/conversations/:id/messages/:messageId/reactions`
- API/worker source reads: `services/greenfield-api/src/domains/messaging/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/messaging/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_messaging_privacy`

- Purpose: application state for greenfield messaging privacy
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `089_messaging_v3.sql`
- Routes reading: `GET /v1/conversations/:id/messages`, `GET /v1/conversations/:id/messages/:messageId/receipts`, `POST /v1/conversations/:id/read`, `GET /v1/conversations/:id/typing`, `POST /v1/conversations/:id/typing`, `GET /v1/messaging/privacy`, `PATCH /v1/messaging/privacy`, `GET /v1/messaging/socket`, `GET /v1/presence`
- Routes writing: `PATCH /v1/messaging/privacy`
- API/worker source reads: `services/greenfield-api/src/domains/messaging/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/messaging/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_action_events`

- Purpose: module registry/runtime state
- Primary key: `event_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `module_id`
- Indexes: `greenfield_module_action_even_account_id_module_id_action_i_key`, `greenfield_module_action_events_account_idx`, `greenfield_module_action_events_pkey`
- Unique constraints: `greenfield_module_action_even_account_id_module_id_action_i_key(account_id,module_id,action_id,idempotency_key)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `010_phase7b_module_runtime.sql`
- Routes reading: `POST /v1/modules/:moduleId/actions/:actionId`, `GET /v1/modules/:moduleId/health`
- Routes writing: `POST /v1/modules/:moduleId/actions/:actionId`
- API/worker source reads: `services/greenfield-api/src/modules/action-service.ts`, `services/greenfield-api/src/modules/health-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/action-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_actions`

- Purpose: module registry/runtime state
- Primary key: `action_row_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `module_id`
- Indexes: `greenfield_module_actions_module_idx`, `greenfield_module_actions_pkey`, `greenfield_module_actions_release_id_action_id_key`
- Unique constraints: `greenfield_module_actions_release_id_action_id_key(release_id,action_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `010_phase7b_module_runtime.sql`
- Routes reading: `POST /v1/modules/:moduleId/actions/:actionId`, `GET /v1/modules/:moduleId/views`, `GET /v1/modules/:moduleId/views/:viewId`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/action-service.ts`, `services/greenfield-api/src/modules/view-service.ts`
- API/worker source writes: `services/greenfield-worker/src/modules/contribution-registration-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_api_registrations`

- Purpose: module registry/runtime state
- Primary key: `api_registration_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `module_id`
- Indexes: `greenfield_module_api_registrat_installation_id_method_path_key`, `greenfield_module_api_registrations_installation_id_api_id_key`, `greenfield_module_api_registrations_path_idx`, `greenfield_module_api_registrations_pkey`
- Unique constraints: `greenfield_module_api_registrat_installation_id_method_path_key(installation_id,method,path)`, `greenfield_module_api_registrations_installation_id_api_id_key(installation_id,api_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: `GET /v1/modules/:moduleId/runtime`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/runtime2-service.ts`
- API/worker source writes: `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_capability_registry`

- Purpose: module registry/runtime state
- Primary key: `capability_registration_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `module_id`, `provider_module_id`, `provider_installation_id`
- Indexes: `greenfield_module_capability__installation_id_capability_pr_key`, `greenfield_module_capability_registry_module_idx`, `greenfield_module_capability_registry_pkey`
- Unique constraints: `greenfield_module_capability__installation_id_capability_pr_key(installation_id,capability,provider_kind)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: `GET /v1/modules/:moduleId/runtime`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/runtime2-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/runtime2-service.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_contributions`

- Purpose: module registry/runtime state
- Primary key: `contribution_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `module_id`
- Indexes: `greenfield_module_contributions_module_idx`, `greenfield_module_contributions_pkey`, `greenfield_module_contributions_release_id_contribution_key_key`
- Unique constraints: `greenfield_module_contributions_release_id_contribution_key_key(release_id,contribution_key)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `POST /v1/module-runtime/actions/:targetModuleId/:actionId/:version`, `POST /v1/modules/:moduleId/functions/:functionId/:version/invoke`, `POST /v1/modules/:moduleId/host-function-requests/:requestId/complete`, `DELETE /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/uninstall-preview`, `GET /v1/modules/contributions`
- Routes writing: `POST /v1/admin/registry/modules/import`, `POST /v1/admin/registry/releases/:releaseId/quarantine`, `POST /v1/admin/registry/releases/:releaseId/verify`
- API/worker source reads: `services/greenfield-api/src/modules/contribution-service.ts`, `services/greenfield-api/src/modules/governed-function-service.ts`, `services/greenfield-api/src/modules/inter-module-action-service.ts`, `services/greenfield-api/src/modules/uninstall-service.ts`, `services/greenfield-worker/src/modules/contribution-registration-handler.ts`, `services/greenfield-worker/src/modules/schema-registration-handler.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`, `services/greenfield-worker/src/modules/contribution-registration-handler.ts`, `services/greenfield-worker/src/modules/schema-registration-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_data_retention`

- Purpose: module registry/runtime state
- Primary key: `retention_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `account_id`, `module_id`, `installation_id`
- Indexes: `greenfield_module_data_retention_account_idx`, `greenfield_module_data_retention_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `completed_at`, `created_at`
- Migration introduced: `010_phase7b_module_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-worker/src/modules/uninstall-handler.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_module_dependencies`

- Purpose: module registry/runtime state
- Primary key: `dependency_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `module_id`, `dependency_module_id`
- Indexes: `greenfield_module_dependencie_release_id_dependency_module__key`, `greenfield_module_dependencies_pkey`
- Unique constraints: `greenfield_module_dependencie_release_id_dependency_module__key(release_id,dependency_module_id)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/registry/modules/import`
- API/worker source reads: `services/greenfield-api/src/modules/dependency-resolver.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_export_jobs`

- Purpose: module registry/runtime state
- Primary key: `export_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `account_id`, `module_id`, `installation_id`
- Indexes: `greenfield_module_export_jobs_account_idx`, `greenfield_module_export_jobs_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `completed_at`
- Migration introduced: `022_phase7e_module_records_and_vault_notes.sql`
- Routes reading: `GET /v1/modules/:moduleId/health`
- Routes writing: `POST /v1/modules/:moduleId/export`
- API/worker source reads: `services/greenfield-api/src/modules/health-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/export-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_hook_registrations`

- Purpose: module registry/runtime state
- Primary key: `hook_registration_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `module_id`
- Indexes: `greenfield_module_hook_regist_installation_id_phase_target__key`, `greenfield_module_hook_registration_installation_id_hook_id_key`, `greenfield_module_hook_registrations_pkey`, `greenfield_module_hook_registrations_target_idx`
- Unique constraints: `greenfield_module_hook_regist_installation_id_phase_target__key(installation_id,phase,target,order_index)`, `greenfield_module_hook_registration_installation_id_hook_id_key(installation_id,hook_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: `GET /v1/modules/:moduleId/runtime`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/runtime2-service.ts`
- API/worker source writes: `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_install_plans`

- Purpose: module registry/runtime state
- Primary key: `plan_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`
- Indexes: `greenfield_module_install_plans_account_id_idempotency_key_key`, `greenfield_module_install_plans_pkey`
- Unique constraints: `greenfield_module_install_plans_account_id_idempotency_key_key(account_id,idempotency_key)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `POST /v1/modules/:moduleId/install`, `GET /v1/modules/:moduleId/install-descriptor`, `POST /v1/modules/:moduleId/rollback`, `POST /v1/modules/:moduleId/update`
- Routes writing: `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/rollback`, `POST /v1/modules/:moduleId/update`
- API/worker source reads: `services/greenfield-api/src/modules/installation-service.ts`, `services/greenfield-api/src/modules/legacy-upgrade-progress.ts`, `services/greenfield-api/src/modules/update-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/installation-service.ts`, `services/greenfield-api/src/modules/update-service.ts`, `services/greenfield-worker/src/modules/installation-handler.ts`, `services/greenfield-worker/src/modules/update-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_installation_settings`

- Purpose: module registry/runtime state
- Primary key: `settings_id`
- Foreign keys: `installation_id -> greenfield_extension_installations.installation_id`, `updated_by -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `installation_id`, `module_id`
- Indexes: `greenfield_module_installation_settings_installation_id_key`, `greenfield_module_installation_settings_pkey`
- Unique constraints: `greenfield_module_installation_settings_installation_id_key(installation_id)`
- Soft delete: none
- Timestamps: `updated_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `DELETE /v1/modules/:moduleId/install`, `GET /v1/modules/:moduleId/settings`, `PATCH /v1/modules/:moduleId/settings`, `POST /v1/modules/:moduleId/uninstall-preview`
- Routes writing: `PATCH /v1/modules/:moduleId/settings`
- API/worker source reads: `services/greenfield-api/src/modules/settings-service.ts`, `services/greenfield-api/src/modules/uninstall-service.ts`, `services/greenfield-worker/src/modules/legacy-installation-data-migration.ts`
- API/worker source writes: `services/greenfield-api/src/modules/settings-service.ts`, `services/greenfield-worker/src/modules/installation-handler.ts`, `services/greenfield-worker/src/modules/legacy-installation-data-migration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_job_registrations`

- Purpose: module registry/runtime state
- Primary key: `job_registration_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `module_id`
- Indexes: `greenfield_module_job_registrations_installation_id_job_key_key`, `greenfield_module_job_registrations_pause_idx`, `greenfield_module_job_registrations_pkey`
- Unique constraints: `greenfield_module_job_registrations_installation_id_job_key_key(installation_id,job_key)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: `POST /v1/backend/products/:productId/jobs`, `POST /v1/backend/products/:productId/jobs/claim`, `GET /v1/modules/:moduleId/runtime`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/backend-fabric/event-job-service.ts`, `services/greenfield-api/src/modules/runtime2-service.ts`
- API/worker source writes: `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_license_evidence`

- Purpose: module registry/runtime state
- Primary key: `evidence_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_license_evidence_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/registry/modules/import`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_module_lifecycle_stages`

- Purpose: module registry/runtime state
- Primary key: `stage_id`
- Foreign keys: `transaction_id -> greenfield_module_lifecycle_transactions.transaction_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_lifecycle_stag_transaction_id_order_index_key`, `greenfield_module_lifecycle_stages_pkey`, `greenfield_module_lifecycle_stages_transaction_id_stage_key`
- Unique constraints: `greenfield_module_lifecycle_stag_transaction_id_order_index_key(transaction_id,order_index)`, `greenfield_module_lifecycle_stages_transaction_id_stage_key(transaction_id,stage)`
- Soft delete: none
- Timestamps: `started_at`, `completed_at`, `created_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/modules/runtime2-service.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_module_lifecycle_transactions`

- Purpose: module registry/runtime state
- Primary key: `transaction_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `module_id`
- Indexes: `greenfield_module_lifecycle_transactions_installation_idx`, `greenfield_module_lifecycle_transactions_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `started_at`, `completed_at`, `created_at`, `updated_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/modules/runtime2-service.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_module_permission_reviews`

- Purpose: module registry/runtime state
- Primary key: `review_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`
- Indexes: `greenfield_module_permission_rev_account_id_idempotency_key_key`, `greenfield_module_permission_reviews_pkey`
- Unique constraints: `greenfield_module_permission_rev_account_id_idempotency_key_key(account_id,idempotency_key)`
- Soft delete: none
- Timestamps: `reviewed_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `POST /v1/extensions/:extensionProductId/contributions/:contributionId/invoke`, `POST /v1/modules/:moduleId/ai/requests`, `GET /v1/modules/:moduleId/backend`, `POST /v1/modules/:moduleId/backend/disable`, `POST /v1/modules/:moduleId/backend/discover`, `POST /v1/modules/:moduleId/backend/health`, `POST /v1/modules/:moduleId/disable`, `POST /v1/modules/:moduleId/enable`, `POST /v1/modules/:moduleId/install`, `GET /v1/modules/:moduleId/install-descriptor`, `GET /v1/modules/:moduleId/installation-descriptor`, `POST /v1/modules/:moduleId/permissions/review`, `POST /v1/modules/:moduleId/rollback`, `POST /v1/modules/:moduleId/update-plan`, `PATCH /v1/modules/installations/:installationId/update-policy`, `GET /v1/modules/installed`, `GET /v1/modules/installed/:moduleId`, `GET /v1/modules/updates`
- Routes writing: `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/permissions/review`, `POST /v1/modules/:moduleId/rollback`, `POST /v1/modules/:moduleId/update`
- API/worker source reads: `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/installation-service.ts`, `services/greenfield-api/src/modules/permission-reconciliation-service.ts`, `services/greenfield-api/src/modules/runtime-access.ts`, `services/greenfield-worker/src/modules/enable-handler.ts`, `services/greenfield-worker/src/modules/installation-handler.ts`, `services/greenfield-worker/src/modules/update-handler.ts`
- API/worker source writes: `services/greenfield-api/src/modules/installation-service.ts`, `services/greenfield-api/src/modules/permission-reconciliation-service.ts`, `services/greenfield-api/src/modules/update-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_permission_states`

- Purpose: module registry/runtime state
- Primary key: `permission_state_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `module_id`
- Indexes: `greenfield_module_permission_sta_installation_id_permission_key`, `greenfield_module_permission_states_activation_idx`, `greenfield_module_permission_states_pkey`
- Unique constraints: `greenfield_module_permission_sta_installation_id_permission_key(installation_id,permission)`
- Soft delete: none
- Timestamps: `granted_at`, `denied_at`, `revoked_at`, `updated_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: `GET /v1/modules/:moduleId/runtime`, `POST /v1/modules/:moduleId/services/:serviceId/invoke`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/runtime2-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/runtime2-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_permissions`

- Purpose: module registry/runtime state
- Primary key: `permission_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_permissions_pkey`, `greenfield_module_permissions_release_id_permission_key`
- Unique constraints: `greenfield_module_permissions_release_id_permission_key(release_id,permission)`
- Soft delete: none
- Timestamps: `requested_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/registry/modules/import`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_module_quarantines`

- Purpose: module registry/runtime state
- Primary key: `quarantine_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_quarantines_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `lifted_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `GET /v1/modules/updates`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`
- Routes writing: `POST /v1/admin/registry/releases/:releaseId/quarantine`, `POST /v1/admin/registry/releases/:releaseId/verify`
- API/worker source reads: `services/greenfield-api/src/domains/comments/sticker-service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/registry-trust-service.ts`, `services/greenfield-worker/src/modules/release-trust-guard.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_ratings`

- Purpose: module registry/runtime state
- Primary key: `rating_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `module_id`, `account_id`
- Indexes: `greenfield_module_ratings_module_id_account_id_key`, `greenfield_module_ratings_module_idx`, `greenfield_module_ratings_pkey`
- Unique constraints: `greenfield_module_ratings_module_id_account_id_key(module_id,account_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `038_phase7m_b10_module_marketplace.sql`
- Routes reading: `PUT /v1/registry/modules/:moduleId/rating`
- Routes writing: `PUT /v1/registry/modules/:moduleId/rating`
- API/worker source reads: `services/greenfield-api/src/modules/marketplace-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/marketplace-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_record_changes`

- Purpose: module registry/runtime state
- Primary key: `change_sequence`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `owner_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`, `module_id`, `owner_account_id`
- Indexes: `greenfield_module_record_changes_owner_idx`, `greenfield_module_record_changes_pkey`, `greenfield_module_record_changes_sync_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `068_module_platform_records.sql`
- Routes reading: `GET /v1/modules/:moduleId/records/sync`
- Routes writing: `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `DELETE /v1/modules/:moduleId/record-shares/:shareId`, `PATCH /v1/modules/:moduleId/record-shares/:shareId`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection/:recordId/media`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PUT /v1/modules/:moduleId/records/:collection/:recordId/media/order`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`, `POST /v1/modules/:moduleId/records/:collection/:recordId/shares`, `GET /v1/modules/:moduleId/records/sync`
- API/worker source reads: `services/greenfield-api/src/modules/record-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/media-binding-service.ts`, `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-api/src/modules/record-sharing-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_record_collections`

- Purpose: module registry/runtime state
- Primary key: `collection_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `module_id`
- Indexes: `greenfield_module_record_collections_module_idx`, `greenfield_module_record_collections_pkey`, `greenfield_module_record_collections_release_id_collection_key`
- Unique constraints: `greenfield_module_record_collections_release_id_collection_key(release_id,collection)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `010_phase7b_module_runtime.sql`
- Routes reading: `GET /v1/modules/:moduleId/records/:collection/:recordId/media`, `POST /v1/modules/:moduleId/records/:collection/:recordId/media`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PUT /v1/modules/:moduleId/records/:collection/:recordId/media/order`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/media-binding-service.ts`, `services/greenfield-api/src/modules/view-service.ts`, `services/greenfield-worker/src/modules/legacy-installation-data-migration.ts`, `services/greenfield-worker/src/search/module-record-projector.ts`
- API/worker source writes: `services/greenfield-api/src/product-standard/ingest-service.ts`, `services/greenfield-worker/src/modules/contribution-registration-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_record_events`

- Purpose: module registry/runtime state
- Primary key: `event_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `module_id`
- Indexes: `greenfield_module_record_events_account_idx`, `greenfield_module_record_events_pkey`, `greenfield_module_record_events_record_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `010_phase7b_module_runtime.sql`
- Routes reading: `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/permanent`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`
- Routes writing: `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/permanent`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`
- API/worker source reads: `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-worker/src/modules/legacy-installation-data-migration.ts`
- API/worker source writes: `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-worker/src/modules/legacy-installation-data-migration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_record_media_bindings`

- Purpose: module registry/runtime state
- Primary key: `binding_id`
- Foreign keys: `record_owner_account_id -> greenfield_accounts.account_id`, `asset_owner_account_id -> greenfield_accounts.account_id`, `source_installation_id -> greenfield_extension_installations.installation_id`, `asset_id -> attachments.attachment_id`
- Ownership/workspace/user/module columns: `record_owner_account_id`, `module_id`, `asset_owner_account_id`, `source_installation_id`
- Indexes: `greenfield_module_record_media_asset_idx`, `greenfield_module_record_media_asset_unique`, `greenfield_module_record_media_bindings_pkey`, `greenfield_module_record_media_order_unique`, `greenfield_module_record_media_record_idx`
- Unique constraints: `greenfield_module_record_media_asset_unique(record_owner_account_id,module_id,record_type,record_id,asset_id)`, `greenfield_module_record_media_order_unique(record_owner_account_id,module_id,record_type,record_id,order_index)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `069_module_platform_media_sharing.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/modules/:moduleId/records/:collection/:recordId/media`, `POST /v1/modules/:moduleId/records/:collection/:recordId/media`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PUT /v1/modules/:moduleId/records/:collection/:recordId/media/order`
- Routes writing: `POST /v1/modules/:moduleId/records/:collection/:recordId/media`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PUT /v1/modules/:moduleId/records/:collection/:recordId/media/order`
- API/worker source reads: `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/domains/comments/media.ts`, `services/greenfield-api/src/modules/media-binding-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/media-binding-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_record_mutations`

- Purpose: module registry/runtime state
- Primary key: `mutation_row_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`, `module_id`
- Indexes: `greenfield_module_record_muta_account_id_installation_id_mu_key`, `greenfield_module_record_mutations_pkey`, `greenfield_module_record_mutations_record_idx`
- Unique constraints: `greenfield_module_record_muta_account_id_installation_id_mu_key(account_id,installation_id,mutation_id)`
- Soft delete: none
- Timestamps: `created_at`, `completed_at`
- Migration introduced: `068_module_platform_records.sql`
- Routes reading: `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`
- Routes writing: `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`
- API/worker source reads: `services/greenfield-api/src/modules/record-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/record-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_record_references`

- Purpose: module registry/runtime state
- Primary key: `reference_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `source_installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `account_id`, `source_installation_id`, `source_module_id`, `target_module_id`
- Indexes: `greenfield_module_record_refe_account_id_source_module_id_s_key`, `greenfield_module_record_references_pkey`, `greenfield_module_record_references_source_idx`, `greenfield_module_record_references_target_idx`
- Unique constraints: `greenfield_module_record_refe_account_id_source_module_id_s_key(account_id,source_module_id,source_record_type,source_record_id,field_path,ordinal)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `068_module_platform_records.sql`
- Routes reading: `GET /v1/modules/:moduleId/records/:collection/:recordId/references`, `GET /v1/modules/:moduleId/records/:collection/:recordId/reverse-references`
- Routes writing: `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`
- API/worker source reads: `services/greenfield-api/src/modules/record-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/record-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_record_revisions`

- Purpose: module registry/runtime state
- Primary key: `revision_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`, `module_id`, `actor_id`
- Indexes: `greenfield_module_record_revi_account_id_module_id_record_t_key`, `greenfield_module_record_revisions_pkey`, `greenfield_module_record_revisions_record_idx`
- Unique constraints: `greenfield_module_record_revi_account_id_module_id_record_t_key(account_id,module_id,record_type,record_id,revision)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `068_module_platform_records.sql`
- Routes reading: `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `GET /v1/modules/:moduleId/record-shares/:shareId/revisions`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`, `GET /v1/modules/:moduleId/records/:collection/:recordId/revisions`, `GET /v1/modules/:moduleId/records/:collection/:recordId/revisions/:revision`
- Routes writing: `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`
- API/worker source reads: `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-api/src/modules/record-sharing-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/record-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_record_shares`

- Purpose: module registry/runtime state
- Primary key: `share_id`
- Foreign keys: `owner_account_id -> greenfield_accounts.account_id`, `recipient_account_id -> greenfield_accounts.account_id`, `source_installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `owner_account_id`, `recipient_account_id`, `source_installation_id`, `module_id`
- Indexes: `greenfield_module_record_shar_owner_account_id_source_insta_key`, `greenfield_module_record_shares_active_recipient_idx`, `greenfield_module_record_shares_owner_idx`, `greenfield_module_record_shares_pkey`, `greenfield_module_record_shares_recipient_idx`
- Unique constraints: `greenfield_module_record_shar_owner_account_id_source_insta_key(owner_account_id,source_installation_id,mutation_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `expires_at`, `revoked_at`, `visibility_lost_at`
- Migration introduced: `069_module_platform_media_sharing.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `DELETE /v1/modules/:moduleId/record-shares/:shareId`, `GET /v1/modules/:moduleId/record-shares/:shareId`, `PATCH /v1/modules/:moduleId/record-shares/:shareId`, `PATCH /v1/modules/:moduleId/record-shares/:shareId/record`, `GET /v1/modules/:moduleId/record-shares/:shareId/revisions`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection/:recordId/media`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PUT /v1/modules/:moduleId/records/:collection/:recordId/media/order`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`, `POST /v1/modules/:moduleId/records/:collection/:recordId/shares`, `GET /v1/modules/:moduleId/records/shares/owned`, `GET /v1/modules/:moduleId/records/shares/received`, `GET /v1/modules/:moduleId/records/sync`
- Routes writing: `DELETE /v1/modules/:moduleId/record-shares/:shareId`, `PATCH /v1/modules/:moduleId/record-shares/:shareId`, `POST /v1/modules/:moduleId/records/:collection/:recordId/shares`, `GET /v1/modules/:moduleId/records/sync`
- API/worker source reads: `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/domains/search/module-record-access.ts`, `services/greenfield-api/src/domains/search/repository.ts`, `services/greenfield-api/src/modules/media-binding-service.ts`, `services/greenfield-api/src/modules/record-access-service.ts`, `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-api/src/modules/record-sharing-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-api/src/modules/record-sharing-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_record_versions`

- Purpose: module registry/runtime state
- Primary key: `version_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`, `module_id`
- Indexes: `greenfield_module_record_vers_account_id_module_id_collecti_key`, `greenfield_module_record_versions_pkey`, `greenfield_module_record_versions_record_idx`
- Unique constraints: `greenfield_module_record_vers_account_id_module_id_collecti_key(account_id,module_id,collection,record_id,revision)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `022_phase7e_module_records_and_vault_notes.sql`
- Routes reading: `GET /v1/modules/:moduleId/health`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/permanent`
- Routes writing: `DELETE /v1/modules/:moduleId/records/:collection/:recordId/permanent`
- API/worker source reads: `services/greenfield-api/src/modules/health-service.ts`, `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-worker/src/modules/legacy-installation-data-migration.ts`
- API/worker source writes: `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-worker/src/modules/legacy-installation-data-migration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_records`

- Purpose: module registry/runtime state
- Primary key: `record_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `account_id`, `module_id`, `installation_id`
- Indexes: `greenfield_module_records_account_id_module_id_collection_r_key`, `greenfield_module_records_account_module_idx`, `greenfield_module_records_folder_idx`, `greenfield_module_records_pkey`, `greenfield_module_records_search_idx`
- Unique constraints: `greenfield_module_records_account_id_module_id_collection_r_key(account_id,module_id,collection,record_id)`
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `010_phase7b_module_runtime.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `GET /v1/attachments/:attachmentId/content`, `GET /v1/backend/products/:productId/records/:collection`, `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `GET /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `POST /v1/extensions/:extensionProductId/contributions/:contributionId/invoke`, `POST /v1/extensions/:extensionProductId/jobs`, `POST /v1/modules/:moduleId/export`, `GET /v1/modules/:moduleId/health`, `DELETE /v1/modules/:moduleId/install`, `DELETE /v1/modules/:moduleId/record-shares/:shareId`, `GET /v1/modules/:moduleId/record-shares/:shareId`, `PATCH /v1/modules/:moduleId/record-shares/:shareId`, `GET /v1/modules/:moduleId/records/:collection`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `GET /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection/:recordId/media`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/permanent`, `GET /v1/modules/:moduleId/records/:collection/:recordId/references`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`, `GET /v1/modules/:moduleId/records/:collection/:recordId/reverse-references`, `GET /v1/modules/:moduleId/records/:collection/:recordId/revisions`, `GET /v1/modules/:moduleId/records/:collection/:recordId/revisions/:revision`, `GET /v1/modules/:moduleId/records/:collection/:recordId/revisions/current`, `POST /v1/modules/:moduleId/records/:collection/:recordId/shares`, `GET /v1/modules/:moduleId/records/sync`, `POST /v1/modules/:moduleId/services/:serviceId/invoke`, `POST /v1/modules/:moduleId/uninstall-preview`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/permanent`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/domains/search/module-record-access.ts`, `services/greenfield-api/src/modules/export-service.ts`, `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-api/src/modules/health-service.ts`, `services/greenfield-api/src/modules/identity-migration-service.ts`, `services/greenfield-api/src/modules/media-binding-service.ts`, `services/greenfield-api/src/modules/record-access-service.ts`, `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-api/src/modules/record-sharing-service.ts`, `services/greenfield-api/src/modules/runtime2-service.ts`, `services/greenfield-api/src/modules/uninstall-service.ts`, `services/greenfield-worker/src/modules/legacy-installation-data-migration.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts`, `services/greenfield-worker/src/search/index.ts`, `services/greenfield-worker/src/search/module-record-projector.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/modules/identity-migration-service.ts`, `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-worker/src/modules/legacy-installation-data-migration.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_release_integrity`

- Purpose: module registry/runtime state
- Primary key: `integrity_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_release_integrity_pkey`, `greenfield_module_release_integrity_release_id_key`
- Unique constraints: `greenfield_module_release_integrity_release_id_key(release_id)`
- Soft delete: none
- Timestamps: `verified_at`, `mismatch_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `POST /v1/admin/registry/releases/:releaseId/signature`, `GET /v1/modules/updates`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`
- Routes writing: `POST /v1/admin/registry/modules/import`
- API/worker source reads: `services/greenfield-api/src/domains/comments/sticker-service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/registry-trust-service.ts`, `services/greenfield-api/src/modules/release-service.ts`, `services/greenfield-worker/src/modules/release-trust-guard.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`, `services/greenfield-worker/src/modules/release-verification-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_release_signatures`

- Purpose: module registry/runtime state
- Primary key: `signature_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_release_signa_release_id_signature_key_id_key`, `greenfield_module_release_signatures_pkey`
- Unique constraints: `greenfield_module_release_signa_release_id_signature_key_id_key(release_id,signature_key_id)`
- Soft delete: none
- Timestamps: `verified_at`, `revoked_at`, `observed_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `POST /v1/admin/registry/releases/:releaseId/signature`, `POST /v1/admin/registry/releases/:releaseId/verify`, `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/install-plan`, `GET /v1/modules/:moduleId/installation-descriptor`, `POST /v1/modules/:moduleId/package-install-plan`, `POST /v1/modules/:moduleId/rollback`, `POST /v1/modules/:moduleId/update`, `POST /v1/modules/:moduleId/update-plan`, `PATCH /v1/modules/installations/:installationId/update-policy`, `GET /v1/modules/updates`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`, `GET /v1/publisher/modules/:moduleId`, `GET /v1/publisher/modules/:moduleId/versions`, `GET /v1/registry/releases/:releaseId/descriptor`
- Routes writing: `POST /v1/admin/registry/modules/import`, `POST /v1/admin/registry/publishers/:publisherId/signing-keys/:keyId/revoke`, `POST /v1/admin/registry/releases/:releaseId/signature`, `POST /v1/admin/registry/releases/:releaseId/verify`
- API/worker source reads: `services/greenfield-api/src/domains/comments/sticker-service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/registry-trust-service.ts`, `services/greenfield-api/src/modules/release-service.ts`, `services/greenfield-api/src/product-standard/ingest-service.ts`, `services/greenfield-api/src/publisher/release-job-processor.ts`, `services/greenfield-api/src/publisher/release-job-service.ts`, `services/greenfield-worker/src/modules/release-trust-guard.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`, `services/greenfield-api/src/modules/release-signing.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_releases`

- Purpose: module registry/runtime state
- Primary key: `release_id`
- Foreign keys: `extension_id -> greenfield_extensions.extension_id`, `extension_version_id -> greenfield_extension_versions.extension_version_id`, `module_version_id -> greenfield_module_versions.module_version_id`, `publisher_id -> greenfield_publishers.publisher_id`
- Ownership/workspace/user/module columns: `module_id`
- Indexes: `greenfield_module_releases_extension_version_id_key`, `greenfield_module_releases_module_id_version_key`, `greenfield_module_releases_module_idx`, `greenfield_module_releases_module_version_id_key`, `greenfield_module_releases_pkey`, `greenfield_module_releases_product_kind_idx`, `greenfield_module_releases_publisher_idx`
- Unique constraints: `greenfield_module_releases_extension_version_id_key(extension_version_id)`, `greenfield_module_releases_module_id_version_key(module_id,version)`, `greenfield_module_releases_module_version_id_key(module_version_id)`
- Soft delete: none
- Timestamps: `published_at`, `quarantined_at`, `revoked_at`, `superseded_at`, `created_at`, `updated_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `GET /v1/admin/registry/artifacts/orphans`, `POST /v1/admin/registry/modules/import`, `POST /v1/admin/registry/releases/:releaseId/quarantine`, `POST /v1/admin/registry/releases/:releaseId/revoke`, `POST /v1/admin/registry/releases/:releaseId/signature`, `POST /v1/admin/registry/releases/:releaseId/verify`, `GET /v1/attachments/:attachmentId/content`, `POST /v1/backend/products/:productId/records/:collection`, `DELETE /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/backend/products/:productId/records/:collection/:recordId`, `PUT /v1/developer/gubic/games/:gameId`, `POST /v1/extensions/:extensionProductId/contributions/:contributionId/invoke`, `GET /v1/gubic/categories`, `GET /v1/gubic/featured`, `GET /v1/gubic/games`, `GET /v1/gubic/games/:gameId`, `GET /v1/gubic/games/:gameId/eligibility`, `POST /v1/gubic/games/:gameId/install-plan`, `GET /v1/gubic/games/:gameId/versions`, `GET /v1/gubic/my-games`, `GET /v1/gubic/new-releases`, `GET /v1/gubic/publishers/:publisherId`, `GET /v1/module-host/:targetProductId/composition`, `POST /v1/modules/:moduleId/ai/requests`, `GET /v1/modules/:moduleId/backend`, `POST /v1/modules/:moduleId/backend/disable`, `POST /v1/modules/:moduleId/backend/discover`, `POST /v1/modules/:moduleId/backend/health`, `POST /v1/modules/:moduleId/disable`, `POST /v1/modules/:moduleId/enable`, `DELETE /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/install`, `GET /v1/modules/:moduleId/install-descriptor`, `POST /v1/modules/:moduleId/install-plan`, `POST /v1/modules/:moduleId/install-preview`, `POST /v1/modules/:moduleId/package-install-plan`, `POST /v1/modules/:moduleId/permissions/review`, `DELETE /v1/modules/:moduleId/record-shares/:shareId`, `PATCH /v1/modules/:moduleId/record-shares/:shareId`, `POST /v1/modules/:moduleId/records/:collection`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId`, `POST /v1/modules/:moduleId/records/:collection/:recordId/media`, `DELETE /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PATCH /v1/modules/:moduleId/records/:collection/:recordId/media/:bindingId`, `PUT /v1/modules/:moduleId/records/:collection/:recordId/media/order`, `POST /v1/modules/:moduleId/records/:collection/:recordId/restore`, `POST /v1/modules/:moduleId/records/:collection/:recordId/shares`, `POST /v1/modules/:moduleId/rollback`, `GET /v1/modules/:moduleId/runtime`, `POST /v1/modules/:moduleId/services/:serviceId/invoke`, `POST /v1/modules/:moduleId/uninstall-preview`, `POST /v1/modules/:moduleId/update`, `GET /v1/modules/contributions`, `PATCH /v1/modules/installations/:installationId/update-policy`, `GET /v1/modules/installed`, `GET /v1/modules/installed/:moduleId`, `GET /v1/modules/updates`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`, `GET /v1/providers/:capabilityRole`, `PUT /v1/providers/:capabilityRole/default`, `GET /v1/providers/:capabilityRole/resolve`, `GET /v1/publisher/modules`, `GET /v1/publisher/modules/:moduleId`, `GET /v1/publisher/modules/:moduleId/github-releases`, `GET /v1/publisher/modules/:moduleId/release-jobs`, `POST /v1/publisher/modules/:moduleId/release-jobs`, `GET /v1/publisher/modules/:moduleId/versions`, `POST /v1/publisher/release-jobs/:jobId/publish`, `POST /v1/publisher/release-jobs/:jobId/resume`, `GET /v1/registry/artifacts/:sha256`, `GET /v1/registry/modules`, `GET /v1/registry/modules/:moduleId`, `PUT /v1/registry/modules/:moduleId/rating`, `GET /v1/registry/modules/:moduleId/versions`, `GET /v1/registry/modules/:moduleId/versions/:version`, `GET /v1/registry/products`, `GET /v1/registry/products/:productId`, `GET /v1/registry/products/:productId/relationships`, `GET /v1/registry/releases/:releaseId/artifact`, `GET /v1/registry/releases/:releaseId/assets/:assetId`, `GET /v1/registry/releases/:releaseId/descriptor`
- Routes writing: `POST /v1/admin/registry/modules/import`, `POST /v1/admin/registry/releases/:releaseId/quarantine`, `POST /v1/admin/registry/releases/:releaseId/revoke`, `POST /v1/admin/registry/releases/:releaseId/signature`, `POST /v1/admin/registry/releases/:releaseId/verify`, `POST /v1/admin/registry/sync`
- API/worker source reads: `services/greenfield-api/src/domains/comments/sticker-service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`, `services/greenfield-api/src/intelligence/action-boundary.ts`, `services/greenfield-api/src/modules/artifact-closure-service.ts`, `services/greenfield-api/src/modules/contribution-service.ts`, `services/greenfield-api/src/modules/dependency-resolver.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`, `services/greenfield-api/src/modules/identity-migration-service.ts`, `services/greenfield-api/src/modules/installation-service.ts`, `services/greenfield-api/src/modules/legacy-upgrade-progress.ts`, `services/greenfield-api/src/modules/marketplace-service.ts`, `services/greenfield-api/src/modules/media-binding-service.ts`, `services/greenfield-api/src/modules/permission-reconciliation-service.ts`, `services/greenfield-api/src/modules/record-service.ts`, `services/greenfield-api/src/modules/record-sharing-service.ts`, `services/greenfield-api/src/modules/registry-presentation-service.ts`, `services/greenfield-api/src/modules/registry-service.ts`, `services/greenfield-api/src/modules/release-service.ts`, `services/greenfield-api/src/modules/runtime-access.ts`, `services/greenfield-api/src/modules/runtime2-service.ts`, `services/greenfield-api/src/modules/uninstall-service.ts`, `services/greenfield-api/src/product-standard/ingest-service.ts`, `services/greenfield-api/src/providers/service.ts`, `services/greenfield-api/src/publisher/release-job-processor.ts`, `services/greenfield-api/src/publisher/release-job-service.ts`, `services/greenfield-worker/src/modules/disable-handler.ts`, `services/greenfield-worker/src/modules/enable-handler.ts`, `services/greenfield-worker/src/modules/installation-handler.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`, `services/greenfield-worker/src/modules/uninstall-handler.ts`, `services/greenfield-worker/src/modules/update-handler.ts`, `services/greenfield-worker/src/search/index.ts`, `services/greenfield-worker/src/search/module-projector.ts`, `services/greenfield-worker/src/search/module-release-projector.ts`
- API/worker source writes: `services/greenfield-api/src/modules/github-release-sync-service.ts`, `services/greenfield-api/src/modules/release-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_resolved_dependencies`

- Purpose: module registry/runtime state
- Primary key: `resolution_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `plan_id -> greenfield_module_install_plans.plan_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `module_id`, `target_module_id`, `resolved_module_id`
- Indexes: `greenfield_module_resolved_dependencies_contract_idx`, `greenfield_module_resolved_dependencies_installation_idx`, `greenfield_module_resolved_dependencies_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: `GET /v1/modules/:moduleId/runtime`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/runtime2-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/runtime2-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_revocations`

- Purpose: module registry/runtime state
- Primary key: `revocation_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_revocations_pkey`, `greenfield_module_revocations_scope_target_id_key`
- Unique constraints: `greenfield_module_revocations_scope_target_id_key(scope,target_id)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `GET /v1/modules/updates`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`
- Routes writing: `POST /v1/admin/registry/publishers/:publisherId/signing-keys/:keyId/revoke`, `POST /v1/admin/registry/releases/:releaseId/revoke`
- API/worker source reads: `services/greenfield-api/src/domains/comments/sticker-service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/registry-trust-service.ts`, `services/greenfield-worker/src/modules/release-trust-guard.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`, `services/greenfield-api/src/modules/release-signing.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_runtime_credentials`

- Purpose: module registry/runtime state
- Primary key: `credential_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `account_id`, `installation_id`, `module_id`
- Indexes: `greenfield_module_runtime_credentials_credential_hash_key`, `greenfield_module_runtime_credentials_lookup_idx`, `greenfield_module_runtime_credentials_pkey`
- Unique constraints: `greenfield_module_runtime_credentials_credential_hash_key(credential_hash)`
- Soft delete: none
- Timestamps: `expires_at`, `revoked_at`, `created_at`
- Migration introduced: `070_module_platform_functions_actions.sql`
- Routes reading: `POST /v1/module-runtime/actions/:targetModuleId/:actionId/:version`
- Routes writing: `POST /v1/modules/:moduleId/runtime-credentials`, `DELETE /v1/modules/:moduleId/runtime-credentials/:credentialId`
- API/worker source reads: `services/greenfield-api/src/modules/inter-module-action-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/inter-module-action-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_secret_refs`

- Purpose: module registry/runtime state
- Primary key: `secret_ref`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `module_id`
- Indexes: `greenfield_module_secret_refs_installation_id_secret_key_key`, `greenfield_module_secret_refs_pkey`
- Unique constraints: `greenfield_module_secret_refs_installation_id_secret_key_key(installation_id,secret_key)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/modules/runtime2-service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_module_service_invocations`

- Purpose: module registry/runtime state
- Primary key: `invocation_id`
- Foreign keys: `provider_installation_id -> greenfield_extension_installations.installation_id`, `service_registration_id -> greenfield_module_service_registrations.service_registration_id`, `caller_installation_id -> greenfield_extension_installations.installation_id`, `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `caller_installation_id`, `provider_installation_id`, `account_id`, `caller_module_id`, `provider_module_id`
- Indexes: `greenfield_module_service_inv_caller_installation_id_servic_key`, `greenfield_module_service_invocations_pkey`, `greenfield_module_service_invocations_rate_idx`
- Unique constraints: `greenfield_module_service_inv_caller_installation_id_servic_key(caller_installation_id,service_registration_id,idempotency_key)`
- Soft delete: none
- Timestamps: `created_at`, `completed_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: `POST /v1/modules/:moduleId/services/:serviceId/invoke`
- Routes writing: `POST /v1/modules/:moduleId/services/:serviceId/invoke`
- API/worker source reads: `services/greenfield-api/src/modules/runtime2-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/runtime2-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_service_registrations`

- Purpose: module registry/runtime state
- Primary key: `service_registration_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `module_id`
- Indexes: `greenfield_module_service_regist_installation_id_service_id_key`, `greenfield_module_service_registrations_lookup_idx`, `greenfield_module_service_registrations_pkey`
- Unique constraints: `greenfield_module_service_regist_installation_id_service_id_key(installation_id,service_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: `GET /v1/extensions/:extensionProductId/inspector`, `GET /v1/modules/:moduleId/runtime`, `POST /v1/modules/:moduleId/services/:serviceId/invoke`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/backend-fabric/routes.ts`, `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-api/src/modules/runtime2-service.ts`, `services/greenfield-worker/src/modules/extension-job-handler.ts`
- API/worker source writes: `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_settings_versions`

- Purpose: module registry/runtime state
- Primary key: `settings_version_id`
- Foreign keys: `changed_by -> greenfield_accounts.account_id`, `settings_id -> greenfield_module_installation_settings.settings_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_settings_versions_pkey`, `greenfield_module_settings_versions_settings_id_version_key`
- Unique constraints: `greenfield_module_settings_versions_settings_id_version_key(settings_id,version)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: none observed
- Routes writing: `PATCH /v1/modules/:moduleId/settings`
- API/worker source reads: `services/greenfield-worker/src/modules/legacy-installation-data-migration.ts`
- API/worker source writes: `services/greenfield-api/src/modules/settings-service.ts`, `services/greenfield-worker/src/modules/legacy-installation-data-migration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_sources`

- Purpose: module registry/runtime state
- Primary key: `source_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_sources_pkey`, `greenfield_module_sources_release_id_key`
- Unique constraints: `greenfield_module_sources_release_id_key(release_id)`
- Soft delete: none
- Timestamps: `fetched_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `GET /v1/publisher/modules/:moduleId`, `GET /v1/publisher/modules/:moduleId/versions`, `GET /v1/registry/releases/:releaseId/artifact`
- Routes writing: `POST /v1/admin/registry/modules/import`
- API/worker source reads: `services/greenfield-api/src/modules/registry-presentation-service.ts`, `services/greenfield-api/src/modules/registry-trust-service.ts`, `services/greenfield-api/src/publisher/release-job-service.ts`, `services/greenfield-worker/src/modules/release-trust-guard.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_storage_allocations`

- Purpose: module registry/runtime state
- Primary key: `allocation_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `module_id`
- Indexes: `greenfield_module_storage_alloc_installation_id_storage_key_key`, `greenfield_module_storage_allocations_pkey`, `greenfield_module_storage_allocations_scope_idx`
- Unique constraints: `greenfield_module_storage_alloc_installation_id_storage_key_key(installation_id,storage_key)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: `GET /v1/modules/:moduleId/runtime`, `POST /v1/modules/:moduleId/services/:serviceId/invoke`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/runtime2-service.ts`
- API/worker source writes: `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_sync_failures`

- Purpose: module registry/runtime state
- Primary key: `sync_failure_id`
- Foreign keys: `sync_run_id -> greenfield_module_sync_runs.sync_run_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_sync_failures_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/registry/sync`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/modules/github-release-sync-service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_module_sync_runs`

- Purpose: module registry/runtime state
- Primary key: `sync_run_id`
- Foreign keys: `sync_source_id -> greenfield_module_sync_sources.sync_source_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_sync_runs_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `started_at`, `completed_at`, `created_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `GET /v1/admin/registry/sync-runs`
- Routes writing: `POST /v1/admin/registry/sync`
- API/worker source reads: `services/greenfield-api/src/modules/routes/index.ts`
- API/worker source writes: `services/greenfield-api/src/modules/github-release-sync-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_sync_sources`

- Purpose: module registry/runtime state
- Primary key: `sync_source_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_module_sync_sources_pkey`, `greenfield_module_sync_sources_provider_repository_key`
- Unique constraints: `greenfield_module_sync_sources_provider_repository_key(provider,repository)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `greenfield_module_ui_contribution_registrations`

- Purpose: module registry/runtime state
- Primary key: `ui_registration_id`
- Foreign keys: `installation_id -> greenfield_extension_installations.installation_id`, `account_id -> greenfield_accounts.account_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `account_id`, `module_id`
- Indexes: `greenfield_module_ui_contribu_installation_id_contribution__key`, `greenfield_module_ui_contribution_registrations_pkey`, `greenfield_module_ui_contribution_surface_idx`
- Unique constraints: `greenfield_module_ui_contribu_installation_id_contribution__key(installation_id,contribution_key,surface)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `027_phase7e_module_runtime_2.sql`
- Routes reading: `GET /v1/modules/:moduleId/runtime`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/runtime2-service.ts`
- API/worker source writes: `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_versions`

- Purpose: module registry/runtime state
- Primary key: `module_version_id`
- Foreign keys: `extension_version_id -> greenfield_extension_versions.extension_version_id`, `publisher_id -> greenfield_publishers.publisher_id`
- Ownership/workspace/user/module columns: `module_id`
- Indexes: `greenfield_module_versions_extension_version_id_key`, `greenfield_module_versions_module_id_version_key`, `greenfield_module_versions_pkey`
- Unique constraints: `greenfield_module_versions_extension_version_id_key(extension_version_id)`, `greenfield_module_versions_module_id_version_key(module_id,version)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `POST /v1/admin/registry/modules/import`, `POST /v1/admin/registry/releases/:releaseId/signature`, `POST /v1/admin/registry/releases/:releaseId/verify`, `GET /v1/attachments/:attachmentId/content`, `POST /v1/extensions/:extensionProductId/contributions/:contributionId/invoke`, `GET /v1/module-host/:targetProductId/composition`, `POST /v1/modules/:moduleId/ai/requests`, `GET /v1/modules/:moduleId/backend`, `POST /v1/modules/:moduleId/backend/disable`, `POST /v1/modules/:moduleId/backend/discover`, `POST /v1/modules/:moduleId/backend/health`, `GET /v1/modules/updates`, `GET /v1/providers/:capabilityRole`, `PUT /v1/providers/:capabilityRole/default`, `GET /v1/providers/:capabilityRole/resolve`, `GET /v1/publisher/modules`, `GET /v1/publisher/modules/:moduleId`, `GET /v1/publisher/modules/:moduleId/github-releases`, `GET /v1/publisher/modules/:moduleId/release-jobs`, `POST /v1/publisher/modules/:moduleId/release-jobs`, `GET /v1/publisher/modules/:moduleId/versions`, `GET /v1/registry/modules`, `GET /v1/registry/modules/:moduleId`, `GET /v1/registry/modules/:moduleId/versions`, `GET /v1/registry/modules/:moduleId/versions/:version`, `GET /v1/registry/products`, `GET /v1/registry/products/:productId`, `GET /v1/registry/products/:productId/relationships`
- Routes writing: `POST /v1/admin/registry/modules/import`
- API/worker source reads: `services/greenfield-api/src/modules/dependency-resolver.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-api/src/modules/identity-migration-service.ts`, `services/greenfield-api/src/modules/marketplace-service.ts`, `services/greenfield-api/src/modules/registry-service.ts`, `services/greenfield-api/src/modules/release-service.ts`, `services/greenfield-api/src/modules/runtime-access.ts`, `services/greenfield-api/src/providers/service.ts`, `services/greenfield-api/src/publisher/release-job-processor.ts`, `services/greenfield-api/src/publisher/release-job-service.ts`, `services/greenfield-worker/src/modules/standard2-runtime-registration.ts`, `services/greenfield-worker/src/search/module-projector.ts`, `services/greenfield-worker/src/search/module-release-projector.ts`
- API/worker source writes: `services/greenfield-api/src/modules/identity-migration-service.ts`, `services/greenfield-api/src/modules/release-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_module_views`

- Purpose: module registry/runtime state
- Primary key: `view_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `module_id`
- Indexes: `greenfield_module_views_module_idx`, `greenfield_module_views_pkey`, `greenfield_module_views_release_id_view_key_key`
- Unique constraints: `greenfield_module_views_release_id_view_key_key(release_id,view_key)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `010_phase7b_module_runtime.sql`
- Routes reading: `GET /v1/modules/:moduleId/views`, `GET /v1/modules/:moduleId/views/:viewId`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/view-service.ts`
- API/worker source writes: `services/greenfield-worker/src/modules/contribution-registration-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_moliboo_active_buffs`

- Purpose: application state for greenfield moliboo active buffs
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `POST /v1/moliboo/activities/complete`, `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/equip`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `GET /v1/moliboo/characters/:characterId/state`, `POST /v1/moliboo/quests/:questId/claim`
- Routes writing: `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_moliboo_buff_definitions`

- Purpose: application state for greenfield moliboo buff definitions
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `POST /v1/moliboo/activities/complete`, `GET /v1/moliboo/catalogue/items`, `GET /v1/moliboo/catalogue/outfits`, `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/equip`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `GET /v1/moliboo/characters/:characterId/state`, `GET /v1/moliboo/inventory`, `POST /v1/moliboo/outfits`, `PATCH /v1/moliboo/outfits/:outfitId`, `GET /v1/moliboo/quests`, `POST /v1/moliboo/quests/:questId/claim`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_moliboo_characters`

- Purpose: application state for greenfield moliboo characters
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `084_moliboo_signed_packs.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `GET /v1/me/moliboos/outfit`, `PUT /v1/me/moliboos/outfit`, `GET /v1/me/moliboos/ownership`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/moliboos/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_moliboo_equipped`

- Purpose: application state for greenfield moliboo equipped
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `GET /v1/me/moliboos/outfit`, `PUT /v1/me/moliboos/outfit`, `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/equip`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `GET /v1/moliboo/characters/:characterId/state`
- Routes writing: `PUT /v1/me/moliboos/outfit`, `POST /v1/moliboo/characters/:characterId/equip`
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moliboo-game/service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_moliboo_events`

- Purpose: application state for greenfield moliboo events
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `POST /v1/moliboo/activities/complete`, `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/equip`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `GET /v1/moliboo/characters/:characterId/state`
- Routes writing: `POST /v1/moliboo/activities/complete`, `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/equip`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `POST /v1/moliboo/outfits`
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_moliboo_friendship`

- Purpose: application state for greenfield moliboo friendship
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/equip`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `GET /v1/moliboo/characters/:characterId/state`
- Routes writing: `POST /v1/moliboo/activities/complete`, `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `POST /v1/moliboo/quests/:questId/claim`
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_moliboo_inventory`

- Purpose: application state for greenfield moliboo inventory
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `PUT /v1/me/moliboos/outfit`, `GET /v1/me/moliboos/ownership`, `GET /v1/moliboo/catalogue/outfits`, `POST /v1/moliboo/characters/:characterId/equip`, `GET /v1/moliboo/inventory`, `POST /v1/moliboo/outfits`, `PATCH /v1/moliboo/outfits/:outfitId`, `POST /v1/moliboo/quests/:questId/claim`
- Routes writing: `POST /v1/moliboo/quests/:questId/claim`
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_moliboo_items`

- Purpose: application state for greenfield moliboo items
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `GET /v1/me/moliboos/outfit`, `PUT /v1/me/moliboos/outfit`, `GET /v1/me/moliboos/ownership`, `POST /v1/moliboo/activities/complete`, `GET /v1/moliboo/catalogue/items`, `GET /v1/moliboo/catalogue/outfits`, `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/equip`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `GET /v1/moliboo/characters/:characterId/state`, `GET /v1/moliboo/inventory`, `POST /v1/moliboo/outfits`, `PATCH /v1/moliboo/outfits/:outfitId`, `GET /v1/moliboo/quests`, `POST /v1/moliboo/quests/:questId/claim`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_moliboo_outfit_sets`

- Purpose: application state for greenfield moliboo outfit sets
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `POST /v1/moliboo/activities/complete`, `GET /v1/moliboo/catalogue/items`, `GET /v1/moliboo/catalogue/outfits`, `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/equip`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `GET /v1/moliboo/characters/:characterId/state`, `GET /v1/moliboo/inventory`, `POST /v1/moliboo/outfits`, `PATCH /v1/moliboo/outfits/:outfitId`, `GET /v1/moliboo/quests`, `POST /v1/moliboo/quests/:questId/claim`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_moliboo_pack_release_events`

- Purpose: application state for greenfield moliboo pack release events
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `084_moliboo_signed_packs.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/domains/moliboos/service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_moliboo_pack_releases`

- Purpose: application state for greenfield moliboo pack releases
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `084_moliboo_signed_packs.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`
- Routes writing: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`
- API/worker source reads: `services/greenfield-api/src/domains/moliboos/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moliboos/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_moliboo_quest_progress`

- Purpose: application state for greenfield moliboo quest progress
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `GET /v1/moliboo/quests`, `POST /v1/moliboo/quests/:questId/claim`
- Routes writing: `POST /v1/moliboo/activities/complete`, `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/equip`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `POST /v1/moliboo/outfits`, `POST /v1/moliboo/quests/:questId/claim`
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_moliboo_quests`

- Purpose: application state for greenfield moliboo quests
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `POST /v1/moliboo/activities/complete`, `GET /v1/moliboo/catalogue/items`, `GET /v1/moliboo/catalogue/outfits`, `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/equip`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `GET /v1/moliboo/characters/:characterId/state`, `GET /v1/moliboo/inventory`, `POST /v1/moliboo/outfits`, `PATCH /v1/moliboo/outfits/:outfitId`, `GET /v1/moliboo/quests`, `POST /v1/moliboo/quests/:questId/claim`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_moliboo_skills`

- Purpose: application state for greenfield moliboo skills
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `POST /v1/moliboo/characters/:characterId/care`, `POST /v1/moliboo/characters/:characterId/equip`, `POST /v1/moliboo/characters/:characterId/skills/:skillId/use`, `GET /v1/moliboo/characters/:characterId/state`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_moliboo_user_outfits`

- Purpose: application state for greenfield moliboo user outfits
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `083_moliboo_game_systems.sql`
- Routes reading: `POST /v1/moliboo/characters/:characterId/equip`, `GET /v1/moliboo/outfits`, `POST /v1/moliboo/outfits`, `DELETE /v1/moliboo/outfits/:outfitId`, `PATCH /v1/moliboo/outfits/:outfitId`
- Routes writing: `POST /v1/moliboo/outfits`, `DELETE /v1/moliboo/outfits/:outfitId`, `PATCH /v1/moliboo/outfits/:outfitId`
- API/worker source reads: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moliboo-game/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_mps_ingestions`

- Purpose: application state for greenfield mps ingestions
- Primary key: `ingestion_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `product_id`
- Indexes: `greenfield_mps_ingestions_kind_idx`, `greenfield_mps_ingestions_pkey`, `greenfield_mps_ingestions_product_id_version_key`
- Unique constraints: `greenfield_mps_ingestions_product_id_version_key(product_id,version)`
- Soft delete: none
- Timestamps: `ingested_at`
- Migration introduced: `054_greenfield_mps_v1_product_contract.sql`
- Routes reading: `POST /v1/admin/product-standard/ingest`, `POST /v1/admin/registry/releases/:releaseId/signature`, `POST /v1/admin/registry/releases/:releaseId/verify`, `PUT /v1/developer/gubic/games/:gameId`, `GET /v1/gubic/categories`, `GET /v1/gubic/featured`, `GET /v1/gubic/games`, `GET /v1/gubic/games/:gameId`, `GET /v1/gubic/games/:gameId/eligibility`, `POST /v1/gubic/games/:gameId/install-plan`, `GET /v1/gubic/games/:gameId/versions`, `GET /v1/gubic/my-games`, `GET /v1/gubic/new-releases`, `GET /v1/gubic/publishers/:publisherId`, `GET /v1/modules/:moduleId/frontend`, `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/install-plan`, `POST /v1/modules/:moduleId/install-preview`, `POST /v1/modules/:moduleId/package-install-plan`, `POST /v1/modules/:moduleId/update`, `GET /v1/modules/updates`, `GET /v1/product-standard/products/:productId`, `GET /v1/product-standard/products/:productId/versions/:version`, `GET /v1/registry/modules`, `GET /v1/registry/modules/:moduleId`, `GET /v1/registry/modules/:moduleId/versions/:version`, `GET /v1/registry/products`, `GET /v1/registry/products/:productId`
- Routes writing: `POST /v1/admin/product-standard/ingest`
- API/worker source reads: `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`, `services/greenfield-api/src/modules/install-descriptor-service.ts`, `services/greenfield-api/src/modules/registry-service.ts`, `services/greenfield-api/src/modules/registry-trust-service.ts`, `services/greenfield-api/src/modules/release-service.ts`, `services/greenfield-api/src/product-standard/frontend-service.ts`, `services/greenfield-api/src/product-standard/ingest-service.ts`, `services/greenfield-worker/src/modules/release-trust-guard.ts`
- API/worker source writes: `services/greenfield-api/src/product-standard/ingest-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_notification_batches`

- Purpose: application state for greenfield notification batches
- Primary key: `batch_id`
- Foreign keys: `recipient_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `recipient_actor_id`
- Indexes: `greenfield_notification_batches_batch_key_key`, `greenfield_notification_batches_pkey`
- Unique constraints: `greenfield_notification_batches_batch_key_key(batch_key)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `greenfield_notification_delivery`

- Purpose: application state for greenfield notification delivery
- Primary key: `delivery_id`
- Foreign keys: `batch_id -> greenfield_notification_batches.batch_id`, `notification_id -> notifications.id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_notification_delivery_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-worker/src/notifications/social.ts`
- API/worker source writes: `services/greenfield-worker/src/notifications/social.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_offers`

- Purpose: application state for greenfield offers
- Primary key: `offer_id`
- Foreign keys: `created_by_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `product_id`, `created_by_account_id`
- Indexes: `greenfield_offers_pkey`, `greenfield_offers_product_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `049_greenfield_backend_v1_entitlements_usage.sql`
- Routes reading: `POST /v1/admin/commerce/entitlements`, `GET /v1/gubic/games/:gameId/eligibility`, `POST /v1/gubic/games/:gameId/install-plan`, `GET /v1/gubic/my-games`, `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/install-plan`, `POST /v1/modules/:moduleId/install-preview`, `POST /v1/modules/:moduleId/package-install-plan`, `POST /v1/modules/:moduleId/update`
- Routes writing: `PUT /v1/admin/commerce/offers/:offerId`
- API/worker source reads: `services/greenfield-api/src/entitlements/service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`
- API/worker source writes: `services/greenfield-api/src/entitlements/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_passkeys`

- Purpose: application state for greenfield passkeys
- Primary key: `passkey_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `method_id -> greenfield_authentication_methods.method_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_passkeys_credential_id_key`, `greenfield_passkeys_pkey`
- Unique constraints: `greenfield_passkeys_credential_id_key(credential_id)`
- Soft delete: none
- Timestamps: `created_at`, `last_used_at`, `revoked_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `GET /v1/auth/passkeys`, `DELETE /v1/auth/passkeys/:passkeyId`, `POST /v1/auth/passkeys/registration/options`, `POST /v1/auth/passkeys/registration/verify`, `POST /v1/sessions/passkey`, `POST /v1/sessions/passkey/options`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `DELETE /v1/auth/passkeys/:passkeyId`, `POST /v1/auth/passkeys/registration/verify`, `POST /v1/sessions/passkey`
- API/worker source reads: `services/greenfield-api/src/auth/passkeys/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/auth/passkeys/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_password_credentials`

- Purpose: application state for greenfield password credentials
- Primary key: `account_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_password_credentials_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `updated_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/accounts/me/password`, `POST /v1/auth/step-up/password`, `POST /v1/sessions`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/accounts/me/password`, `POST /v1/accounts/recovery/complete`, `POST /v1/accounts/register`, `POST /v1/accounts/reset-password`
- API/worker source reads: `services/greenfield-api/src/accounts/service.ts`, `services/greenfield-api/src/authentication/service.ts`, `services/greenfield-api/src/cli/api-atlas-identities.ts`, `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/accounts/recovery.ts`, `services/greenfield-api/src/accounts/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_plugins`

- Purpose: application state for greenfield plugins
- Primary key: `plugin_id`
- Foreign keys: `extension_version_id -> greenfield_extension_versions.extension_version_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_plugins_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `GET /v1/plugins`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/app/register-routes.ts`
- API/worker source writes: `services/greenfield-worker/src/modules/contribution-registration-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_policy_decision_audit`

- Purpose: application state for greenfield policy decision audit
- Primary key: `decision_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `actor_id -> actors.id`
- Ownership/workspace/user/module columns: `actor_id`, `account_id`, `resource_owner_actor_id`, `module_id`
- Indexes: `greenfield_policy_decision_audit_actor_idx`, `greenfield_policy_decision_audit_denied_idx`, `greenfield_policy_decision_audit_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `020_phase7e_policy_audit_notifications.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/ops/policy/evaluate`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/domains/policy/engine.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_post_draft_content`

- Purpose: application state for greenfield post draft content
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `087_greenfield_collections_and_drafts.sql`
- Routes reading: `DELETE /v1/attachments/:attachmentId`, `POST /v1/posts`
- Routes writing: `DELETE /v1/me/drafts/:draftId`
- API/worker source reads: `services/greenfield-api/src/domains/attachments/service.ts`, `services/greenfield-api/src/domains/drafts/service.ts`, `services/greenfield-api/src/domains/posts/writes.ts`
- API/worker source writes: `services/greenfield-api/src/domains/drafts/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_post_drafts`

- Purpose: application state for greenfield post drafts
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `087_greenfield_collections_and_drafts.sql`
- Routes reading: `GET /v1/me/drafts`, `POST /v1/me/drafts`, `DELETE /v1/me/drafts/:draftId`, `GET /v1/me/drafts/:draftId`, `PATCH /v1/me/drafts/:draftId`, `POST /v1/me/drafts/:draftId/publish`
- Routes writing: `POST /v1/me/drafts`, `DELETE /v1/me/drafts/:draftId`, `PATCH /v1/me/drafts/:draftId`, `POST /v1/me/drafts/:draftId/publish`
- API/worker source reads: `services/greenfield-api/src/domains/drafts/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/drafts/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_post_shares`

- Purpose: application state for greenfield post shares
- Primary key: `share_id`
- Foreign keys: `actor_id -> actors.id`, `post_id -> posts.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `greenfield_post_shares_actor_idx`, `greenfield_post_shares_idempotency_unique`, `greenfield_post_shares_pkey`, `greenfield_post_shares_post_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `046_greenfield_backend_v1_social_completion.sql`
- Routes reading: `GET /v1/creator/insights`, `POST /v1/posts/:postId/share`
- Routes writing: `POST /v1/posts/:postId/share`
- API/worker source reads: `services/greenfield-api/src/domains/shares/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/shares/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_premium_apple_accounts`

- Purpose: application state for greenfield premium apple accounts
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `088_greenfield_premium_apple_sandbox.sql`
- Routes reading: `POST /v1/me/membership/apple-purchase-context`, `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`
- Routes writing: `POST /v1/me/membership/apple-purchase-context`
- API/worker source reads: `services/greenfield-api/src/premium/apple-service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/apple-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_premium_apple_notifications`

- Purpose: application state for greenfield premium apple notifications
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `088_greenfield_premium_apple_sandbox.sql`
- Routes reading: `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`
- Routes writing: `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`
- API/worker source reads: `services/greenfield-api/src/premium/apple-service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/apple-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_premium_apple_products`

- Purpose: application state for greenfield premium apple products
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `088_greenfield_premium_apple_sandbox.sql`
- Routes reading: `PUT /v1/admin/qa/premium/apple-products/:productId`, `POST /v1/me/membership/apple-purchase-context`, `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`
- Routes writing: `PUT /v1/admin/qa/premium/apple-products/:productId`
- API/worker source reads: `services/greenfield-api/src/premium/apple-service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/apple-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_premium_apple_transaction_events`

- Purpose: application state for greenfield premium apple transaction events
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `088_greenfield_premium_apple_sandbox.sql`
- Routes reading: `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`
- Routes writing: `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`
- API/worker source reads: `services/greenfield-api/src/premium/apple-service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/apple-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_premium_apple_transactions`

- Purpose: application state for greenfield premium apple transactions
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `088_greenfield_premium_apple_sandbox.sql`
- Routes reading: `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`
- Routes writing: `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`
- API/worker source reads: `services/greenfield-api/src/premium/apple-service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/apple-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_premium_capabilities`

- Purpose: application state for greenfield premium capabilities
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `076_greenfield_premium_entitlements.sql`
- Routes reading: `POST /v1/developer/gubic/submissions`, `GET /v1/gubic/capabilities`, `POST /v1/gubic/games/:gameId/lobbies`, `GET /v1/me/entitlements`, `GET /v1/me/entitlements/:capabilityId`, `GET /v1/premium/tiers`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/gubic/play-service.ts`, `services/greenfield-api/src/premium/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_premium_catalogue_versions`

- Purpose: application state for greenfield premium catalogue versions
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `076_greenfield_premium_entitlements.sql`
- Routes reading: `PUT /v1/admin/qa/premium/:handle`, `PUT /v1/admin/qa/premium/apple-products/:productId`, `POST /v1/developer/gubic/submissions`, `GET /v1/gubic/capabilities`, `POST /v1/gubic/games/:gameId/lobbies`, `GET /v1/me/entitlements`, `GET /v1/me/entitlements/:capabilityId`, `GET /v1/premium/tiers`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/gubic/play-service.ts`, `services/greenfield-api/src/premium/apple-service.ts`, `services/greenfield-api/src/premium/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_premium_membership_events`

- Purpose: application state for greenfield premium membership events
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `076_greenfield_premium_entitlements.sql`
- Routes reading: `PUT /v1/admin/qa/premium/:handle`
- Routes writing: `PUT /v1/admin/qa/premium/:handle`, `PATCH /v1/me/membership/badge-visibility`, `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`
- API/worker source reads: `services/greenfield-api/src/premium/service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/apple-service.ts`, `services/greenfield-api/src/premium/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_premium_memberships`

- Purpose: application state for greenfield premium memberships
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `076_greenfield_premium_entitlements.sql`
- Routes reading: `PUT /v1/admin/qa/premium/:handle`, `POST /v1/developer/gubic/submissions`, `GET /v1/gubic/capabilities`, `POST /v1/gubic/games/:gameId/lobbies`, `GET /v1/me/entitlements`, `GET /v1/me/entitlements/:capabilityId`, `GET /v1/me/membership`, `PATCH /v1/me/membership/badge-visibility`, `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`
- Routes writing: `PUT /v1/admin/qa/premium/:handle`, `POST /v1/premium/apple/notifications`, `POST /v1/premium/apple/transactions`
- API/worker source reads: `services/greenfield-api/src/gubic/play-service.ts`, `services/greenfield-api/src/premium/apple-service.ts`, `services/greenfield-api/src/premium/badges.ts`, `services/greenfield-api/src/premium/service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/apple-service.ts`, `services/greenfield-api/src/premium/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_premium_preferences`

- Purpose: application state for greenfield premium preferences
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `076_greenfield_premium_entitlements.sql`
- Routes reading: `PUT /v1/admin/qa/premium/:handle`, `GET /v1/me/entitlements`, `GET /v1/me/entitlements/:capabilityId`, `GET /v1/me/membership`, `PATCH /v1/me/membership/badge-visibility`
- Routes writing: `PATCH /v1/me/membership/badge-visibility`
- API/worker source reads: `services/greenfield-api/src/premium/badges.ts`, `services/greenfield-api/src/premium/service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_premium_tiers`

- Purpose: application state for greenfield premium tiers
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `076_greenfield_premium_entitlements.sql`
- Routes reading: `POST /v1/developer/gubic/submissions`, `GET /v1/gubic/capabilities`, `POST /v1/gubic/games/:gameId/lobbies`, `GET /v1/me/entitlements`, `GET /v1/me/entitlements/:capabilityId`, `GET /v1/premium/tiers`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/gubic/play-service.ts`, `services/greenfield-api/src/premium/apple-service.ts`, `services/greenfield-api/src/premium/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_product_families`

- Purpose: application state for greenfield product families
- Primary key: `family_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_product_families_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `054_greenfield_mps_v1_product_contract.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/product-standard/ingest`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/product-standard/ingest-service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_product_family_members`

- Purpose: application state for greenfield product family members
- Primary key: `family_id`, `product_id`
- Foreign keys: `family_id -> greenfield_product_families.family_id`
- Ownership/workspace/user/module columns: `product_id`
- Indexes: `greenfield_product_family_members_pkey`, `greenfield_product_family_members_product_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `054_greenfield_mps_v1_product_contract.sql`
- Routes reading: `POST /v1/admin/product-standard/ingest`, `GET /v1/product-standard/products/:productId`, `GET /v1/product-standard/products/:productId/versions/:version`
- Routes writing: `POST /v1/admin/product-standard/ingest`
- API/worker source reads: `services/greenfield-api/src/product-standard/ingest-service.ts`
- API/worker source writes: `services/greenfield-api/src/product-standard/ingest-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_product_identity_aliases`

- Purpose: application state for greenfield product identity aliases
- Primary key: `alias_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: `canonical_product_id`
- Indexes: `greenfield_product_identity_aliases_canonical_idx`, `greenfield_product_identity_aliases_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `054_greenfield_mps_v1_product_contract.sql`
- Routes reading: `GET /v1/product-standard/products/:productId`
- Routes writing: `POST /v1/admin/product-standard/ingest`
- API/worker source reads: `services/greenfield-api/src/modules/identity-aliases.ts`, `services/greenfield-api/src/product-standard/ingest-service.ts`
- API/worker source writes: `services/greenfield-api/src/product-standard/ingest-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_product_privacy_declarations`

- Purpose: application state for greenfield product privacy declarations
- Primary key: `ingestion_id`
- Foreign keys: `ingestion_id -> greenfield_mps_ingestions.ingestion_id`
- Ownership/workspace/user/module columns: `product_id`
- Indexes: `greenfield_product_privacy_declarations_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `054_greenfield_mps_v1_product_contract.sql`
- Routes reading: `POST /v1/admin/product-standard/ingest`, `GET /v1/product-standard/products/:productId`, `GET /v1/product-standard/products/:productId/versions/:version`
- Routes writing: `POST /v1/admin/product-standard/ingest`
- API/worker source reads: `services/greenfield-api/src/product-standard/ingest-service.ts`
- API/worker source writes: `services/greenfield-api/src/product-standard/ingest-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_product_relationships`

- Purpose: application state for greenfield product relationships
- Primary key: `relationship_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: `product_id`, `target_product_id`
- Indexes: `greenfield_product_relationships_pkey`, `greenfield_product_relationships_product_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `054_greenfield_mps_v1_product_contract.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/product-standard/ingest`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/product-standard/ingest-service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_publisher_namespaces`

- Purpose: application state for greenfield publisher namespaces
- Primary key: `namespace`
- Foreign keys: `publisher_id -> greenfield_publishers.publisher_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_publisher_namespaces_active_unique`, `greenfield_publisher_namespaces_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `verified_at`, `revoked_at`, `created_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `POST /v1/developer/products`, `POST /v1/developer/publishers/:publisherId/namespaces`
- Routes writing: `POST /v1/admin/developer/namespaces/:namespace/verify`, `POST /v1/admin/registry/publishers/:publisherId/revoke`, `POST /v1/developer/publishers/:publisherId/namespaces`
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`, `services/greenfield-api/src/modules/publisher-service.ts`, `services/greenfield-api/src/publisher/release-job-processor.ts`
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`, `services/greenfield-api/src/modules/publisher-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_publisher_owners`

- Purpose: application state for greenfield publisher owners
- Primary key: `publisher_owner_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `organisation_id -> greenfield_developer_organisations.organisation_id`, `publisher_id -> greenfield_publishers.publisher_id`
- Ownership/workspace/user/module columns: `publisher_owner_id`, `account_id`
- Indexes: `greenfield_publisher_owners_pkey`, `greenfield_publisher_owners_publisher_id_account_id_organis_key`
- Unique constraints: `greenfield_publisher_owners_publisher_id_account_id_organis_key(publisher_id,account_id,organisation_id)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `047_greenfield_backend_v1_developer_domain.sql`
- Routes reading: `PUT /v1/developer/gubic/games/:gameId`, `GET /v1/developer/gubic/submissions`, `POST /v1/developer/gubic/submissions`, `POST /v1/developer/gubic/submissions/:submissionId/withdraw`, `POST /v1/developer/products`, `POST /v1/developer/publishers/:publisherId/namespaces`, `GET /v1/publisher/modules`
- Routes writing: `POST /v1/developer/publishers`
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`, `services/greenfield-api/src/gubic/play-service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`, `services/greenfield-api/src/publisher/release-job-service.ts`
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_publisher_release_job_logs`

- Purpose: application state for greenfield publisher release job logs
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `085_publisher_release_console.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/publisher/release-job-core.ts`
- API/worker source writes: `services/greenfield-api/src/publisher/release-job-core.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_publisher_release_jobs`

- Purpose: application state for greenfield publisher release jobs
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `085_publisher_release_console.sql`
- Routes reading: `GET /v1/publisher/modules`, `GET /v1/publisher/modules/:moduleId`, `GET /v1/publisher/modules/:moduleId/github-releases`, `GET /v1/publisher/modules/:moduleId/release-jobs`, `POST /v1/publisher/modules/:moduleId/release-jobs`, `GET /v1/publisher/modules/:moduleId/versions`, `POST /v1/publisher/release-jobs/:jobId/cancel`
- Routes writing: `POST /v1/publisher/modules/:moduleId/release-jobs`
- API/worker source reads: `services/greenfield-api/src/publisher/release-job-core.ts`, `services/greenfield-api/src/publisher/release-job-service.ts`
- API/worker source writes: `services/greenfield-api/src/publisher/release-job-core.ts`, `services/greenfield-api/src/publisher/release-job-processor.ts`, `services/greenfield-api/src/publisher/release-job-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_publisher_signing_key_events`

- Purpose: application state for greenfield publisher signing key events
- Primary key: `event_id`
- Foreign keys: `key_id -> greenfield_publisher_signing_keys.key_id`, `publisher_id -> greenfield_publishers.publisher_id`
- Ownership/workspace/user/module columns: `actor_account_id`
- Indexes: `greenfield_publisher_signing_key_events_key_idx`, `greenfield_publisher_signing_key_events_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `061_registry_publisher_signing_keys.sql`
- Routes reading: `GET /v1/registry/publishers/:publisherId/signing-keys`
- Routes writing: `POST /v1/admin/registry/publishers/:publisherId/signing-keys`, `POST /v1/admin/registry/publishers/:publisherId/signing-keys/:keyId/revoke`
- API/worker source reads: `services/greenfield-api/src/modules/release-signing.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-signing.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_publisher_signing_keys`

- Purpose: application state for greenfield publisher signing keys
- Primary key: `key_id`
- Foreign keys: `publisher_id -> greenfield_publishers.publisher_id`, `rotated_to_key_id -> greenfield_publisher_signing_keys.key_id`
- Ownership/workspace/user/module columns: `registered_by_account_id`
- Indexes: `greenfield_publisher_signing_keys_fingerprint_key`, `greenfield_publisher_signing_keys_pkey`, `greenfield_publisher_signing_keys_publisher_idx`
- Unique constraints: `greenfield_publisher_signing_keys_fingerprint_key(fingerprint)`
- Soft delete: none
- Timestamps: `rotated_at`, `revoked_at`, `created_at`, `updated_at`
- Migration introduced: `061_registry_publisher_signing_keys.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `POST /v1/admin/registry/publishers/:publisherId/signing-keys`, `POST /v1/admin/registry/publishers/:publisherId/signing-keys/:keyId/revoke`, `GET /v1/modules/updates`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`, `GET /v1/registry/publishers/:publisherId/signing-keys`
- Routes writing: `POST /v1/admin/registry/publishers/:publisherId/signing-keys`, `POST /v1/admin/registry/publishers/:publisherId/signing-keys/:keyId/revoke`
- API/worker source reads: `services/greenfield-api/src/domains/comments/sticker-service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/registry-trust-service.ts`, `services/greenfield-api/src/modules/release-signing.ts`, `services/greenfield-worker/src/modules/release-trust-guard.ts`
- API/worker source writes: `services/greenfield-api/src/modules/release-signing.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_publishers`

- Purpose: application state for greenfield publishers
- Primary key: `publisher_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_publishers_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `verified_at`, `suspended_at`, `revoked_at`
- Migration introduced: `009_phase7a_module_platform.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `POST /v1/admin/registry/publishers/:publisherId/revoke`, `POST /v1/admin/registry/publishers/:publisherId/signing-keys`, `POST /v1/admin/registry/publishers/:publisherId/suspend`, `POST /v1/admin/registry/publishers/:publisherId/verify`, `POST /v1/developer/products`, `POST /v1/developer/products/:productId/reviews`, `POST /v1/developer/publishers`, `GET /v1/gubic/publishers/:publisherId`, `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/install-preview`, `GET /v1/modules/updates`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`, `GET /v1/publisher/modules/:moduleId`, `GET /v1/registry/modules`, `GET /v1/registry/products`, `GET /v1/registry/publishers/:publisherId`
- Routes writing: `POST /v1/admin/registry/publishers/:publisherId/revoke`, `POST /v1/admin/registry/publishers/:publisherId/suspend`, `POST /v1/admin/registry/publishers/:publisherId/verify`, `POST /v1/developer/publishers`
- API/worker source reads: `services/greenfield-api/src/developers/service.ts`, `services/greenfield-api/src/domains/comments/sticker-service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`, `services/greenfield-api/src/modules/installation-service.ts`, `services/greenfield-api/src/modules/publisher-service.ts`, `services/greenfield-api/src/modules/registry-service.ts`, `services/greenfield-api/src/modules/registry-trust-service.ts`, `services/greenfield-api/src/modules/release-signing.ts`, `services/greenfield-api/src/publisher/release-job-processor.ts`, `services/greenfield-api/src/publisher/release-job-service.ts`, `services/greenfield-worker/src/modules/release-trust-guard.ts`
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`, `services/greenfield-api/src/modules/publisher-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_quota_counters`

- Purpose: application state for greenfield quota counters
- Primary key: `quota_policy_id`, `bucket_start`
- Foreign keys: `quota_policy_id -> greenfield_quota_policies.quota_policy_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_quota_counters_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `updated_at`
- Migration introduced: `049_greenfield_backend_v1_entitlements_usage.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/backend/products/:productId/usage`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/entitlements/service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_quota_policies`

- Purpose: application state for greenfield quota policies
- Primary key: `quota_policy_id`
- Foreign keys: `created_by_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `created_by_account_id`
- Indexes: `greenfield_quota_policies_pkey`, `greenfield_quota_policies_scope_type_scope_id_metric_window_key`
- Unique constraints: `greenfield_quota_policies_scope_type_scope_id_metric_window_key(scope_type,scope_id,metric,window_seconds)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `049_greenfield_backend_v1_entitlements_usage.sql`
- Routes reading: `POST /v1/backend/products/:productId/usage`
- Routes writing: `PUT /v1/admin/commerce/quotas/:quotaPolicyId`
- API/worker source reads: `services/greenfield-api/src/entitlements/service.ts`
- API/worker source writes: `services/greenfield-api/src/entitlements/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_quote_posts`

- Purpose: application state for greenfield quote posts
- Primary key: `post_id`
- Foreign keys: `post_id -> posts.id`, `quoted_post_id -> posts.id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_quote_posts_pkey`, `greenfield_quote_posts_quoted_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/feed/home`, `GET /v1/feed/profile/:profileId`, `GET /v1/media/:mediaFile`, `GET /v1/posts/:postId`, `DELETE /v1/posts/:postId/like`, `POST /v1/posts/:postId/like`, `DELETE /v1/posts/:postId/repost`, `POST /v1/posts/:postId/repost`, `DELETE /v1/posts/:postId/save`, `POST /v1/posts/:postId/save`, `GET /v1/profiles/:handle/posts`
- Routes writing: `POST /v1/posts/:postId/quote`
- API/worker source reads: `services/greenfield-api/src/domains/posts/repository.ts`
- API/worker source writes: `services/greenfield-api/src/domains/quotes/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_reactions`

- Purpose: application state for greenfield reactions
- Primary key: `reaction_id`
- Foreign keys: `actor_id -> actors.id`, `post_id -> posts.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `greenfield_reactions_actor_id_post_id_key`, `greenfield_reactions_actor_idx`, `greenfield_reactions_created_idx`, `greenfield_reactions_pkey`, `greenfield_reactions_post_idx`, `greenfield_reactions_type_idx`
- Unique constraints: `greenfield_reactions_actor_id_post_id_key(actor_id,post_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `006_phase6s_social_product.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/creator/insights`, `GET /v1/feed/home`, `GET /v1/feed/profile/:profileId`, `GET /v1/media/:mediaFile`, `GET /v1/posts/:postId`, `DELETE /v1/posts/:postId/like`, `POST /v1/posts/:postId/like`, `DELETE /v1/posts/:postId/reaction`, `PUT /v1/posts/:postId/reaction`, `GET /v1/posts/:postId/reactions`, `DELETE /v1/posts/:postId/repost`, `POST /v1/posts/:postId/repost`, `DELETE /v1/posts/:postId/save`, `POST /v1/posts/:postId/save`, `GET /v1/profiles/:handle/posts`
- Routes writing: `DELETE /v1/posts/:postId/like`, `POST /v1/posts/:postId/like`, `DELETE /v1/posts/:postId/reaction`, `PUT /v1/posts/:postId/reaction`, `DELETE /v1/posts/:postId/repost`, `POST /v1/posts/:postId/repost`, `DELETE /v1/posts/:postId/save`, `POST /v1/posts/:postId/save`
- API/worker source reads: `services/greenfield-api/src/domains/posts/repository.ts`, `services/greenfield-api/src/domains/reactions/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`, `services/greenfield-worker/src/digests/digests.ts`, `services/greenfield-worker/src/notifications/social.ts`
- API/worker source writes: `services/greenfield-api/src/domains/reactions/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_record_events`

- Purpose: application state for greenfield record events
- Primary key: `event_id`
- Foreign keys: `record_id -> greenfield_records.record_id`, `repository_id -> greenfield_repositories.repository_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_record_events_event_hash_key`, `greenfield_record_events_pkey`, `greenfield_record_events_repository_idx`
- Unique constraints: `greenfield_record_events_event_hash_key(event_hash)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/repositories/me/records`, `DELETE /v1/repositories/me/records/:recordId`, `PATCH /v1/repositories/me/records/:recordId`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/records/service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_records`

- Purpose: application state for greenfield records
- Primary key: `record_id`
- Foreign keys: `repository_id -> greenfield_repositories.repository_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_records_pkey`, `greenfield_records_repository_idx`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/admin/ops/policy/evaluate`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `POST /v1/repositories/me/exports`, `GET /v1/repositories/me/records`, `POST /v1/repositories/me/records`, `DELETE /v1/repositories/me/records/:recordId`, `GET /v1/repositories/me/records/:recordId`, `PATCH /v1/repositories/me/records/:recordId`
- Routes writing: `POST /v1/accounts/verify-email`, `POST /v1/repositories/me/records`, `DELETE /v1/repositories/me/records/:recordId`, `PATCH /v1/repositories/me/records/:recordId`
- API/worker source reads: `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/records/service.ts`, `services/greenfield-api/src/repositories/service.ts`
- API/worker source writes: `services/greenfield-api/src/accounts/service.ts`, `services/greenfield-api/src/records/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_recovery_code_sets`

- Purpose: application state for greenfield recovery code sets
- Primary key: `set_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `method_id -> greenfield_authentication_methods.method_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_recovery_code_sets_account_idx`, `greenfield_recovery_code_sets_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `generated_at`, `invalidated_at`, `created_at`
- Migration introduced: `031_phase7i_f5_auth_domain.sql`
- Routes reading: `GET /v1/auth/recovery-codes`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/auth/recovery-codes/regenerate`
- API/worker source reads: `services/greenfield-api/src/auth/mfa/recovery-codes.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/auth/mfa/recovery-codes.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_recovery_codes`

- Purpose: application state for greenfield recovery codes
- Primary key: `code_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `set_id -> greenfield_recovery_code_sets.set_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_recovery_codes_account_idx`, `greenfield_recovery_codes_code_hash_key`, `greenfield_recovery_codes_pkey`, `greenfield_recovery_codes_set_idx`
- Unique constraints: `greenfield_recovery_codes_code_hash_key(code_hash)`
- Soft delete: none
- Timestamps: `used_at`, `created_at`
- Migration introduced: `031_phase7i_f5_auth_domain.sql`
- Routes reading: `GET /v1/auth/recovery-codes`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/auth/recovery-codes/regenerate`
- API/worker source reads: `services/greenfield-api/src/auth/mfa/recovery-codes.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/auth/mfa/recovery-codes.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_recovery_tokens`

- Purpose: application state for greenfield recovery tokens
- Primary key: `token_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_recovery_tokens_pkey`, `greenfield_recovery_tokens_token_hash_key`
- Unique constraints: `greenfield_recovery_tokens_token_hash_key(token_hash)`
- Soft delete: none
- Timestamps: `expires_at`, `consumed_at`, `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/accounts/forgot-password`, `POST /v1/accounts/recovery/complete`, `POST /v1/accounts/recovery/request`, `POST /v1/accounts/reset-password`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/accounts/forgot-password`, `POST /v1/accounts/recovery/complete`, `POST /v1/accounts/recovery/request`, `POST /v1/accounts/reset-password`
- API/worker source reads: `services/greenfield-api/src/accounts/recovery.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/accounts/recovery.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_release_artifact_signatures`

- Purpose: module release artifact state
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `084_moliboo_signed_packs.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/comments/sticker-service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_release_artifacts`

- Purpose: module release artifact state
- Primary key: `artifact_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`, `sha256 -> greenfield_release_asset_blobs.sha256`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_release_artifacts_digest_idx`, `greenfield_release_artifacts_pkey`, `greenfield_release_artifacts_release_id_kind_sha256_filenam_key`, `greenfield_release_artifacts_release_idx`
- Unique constraints: `greenfield_release_artifacts_release_id_kind_sha256_filenam_key(release_id,kind,sha256,filename)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `072_module_distribution_protocol.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `GET /v1/admin/registry/artifacts/orphans`, `GET /v1/gubic/categories`, `GET /v1/gubic/featured`, `GET /v1/gubic/games`, `GET /v1/gubic/games/:gameId`, `GET /v1/gubic/games/:gameId/eligibility`, `POST /v1/gubic/games/:gameId/install-plan`, `GET /v1/gubic/games/:gameId/versions`, `GET /v1/gubic/my-games`, `GET /v1/gubic/new-releases`, `GET /v1/gubic/publishers/:publisherId`, `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/install-plan`, `GET /v1/modules/:moduleId/installation-descriptor`, `POST /v1/modules/:moduleId/package-install-plan`, `POST /v1/modules/:moduleId/rollback`, `POST /v1/modules/:moduleId/update`, `POST /v1/modules/:moduleId/update-plan`, `PATCH /v1/modules/installations/:installationId/update-policy`, `GET /v1/modules/updates`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`, `GET /v1/registry/artifacts/:sha256`, `GET /v1/registry/releases/:releaseId/artifact`, `GET /v1/registry/releases/:releaseId/descriptor`
- Routes writing: `POST /v1/admin/registry/sync`
- API/worker source reads: `services/greenfield-api/src/domains/comments/sticker-service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`, `services/greenfield-api/src/modules/artifact-closure-service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/github-release-sync-service.ts`, `services/greenfield-api/src/product-standard/ingest-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_release_asset_blobs`

- Purpose: module release artifact state
- Primary key: `sha256`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_release_asset_blobs_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `059_registry_release_assets.sql`
- Routes reading: `POST /v1/admin/qa/moliboos/packs/:packId/restore`, `POST /v1/admin/qa/moliboos/packs/:packId/withdraw`, `GET /v1/admin/registry/artifacts/orphans`, `GET /v1/gubic/categories`, `GET /v1/gubic/featured`, `GET /v1/gubic/games`, `GET /v1/gubic/games/:gameId`, `GET /v1/gubic/games/:gameId/eligibility`, `POST /v1/gubic/games/:gameId/install-plan`, `GET /v1/gubic/games/:gameId/versions`, `GET /v1/gubic/my-games`, `GET /v1/gubic/new-releases`, `GET /v1/gubic/publishers/:publisherId`, `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/install-plan`, `GET /v1/modules/:moduleId/installation-descriptor`, `POST /v1/modules/:moduleId/package-install-plan`, `POST /v1/modules/:moduleId/rollback`, `POST /v1/modules/:moduleId/update`, `POST /v1/modules/:moduleId/update-plan`, `PATCH /v1/modules/installations/:installationId/update-policy`, `GET /v1/modules/updates`, `GET /v1/moliboos/packs`, `GET /v1/moliboos/packs/:packId/download`, `GET /v1/moliboos/packs/:packId/manifest`, `GET /v1/moliboos/packs/catalog.json`, `GET /v1/registry/artifacts/:sha256`, `GET /v1/registry/modules`, `GET /v1/registry/modules/:moduleId`, `GET /v1/registry/products`, `GET /v1/registry/products/:productId`, `GET /v1/registry/releases/:releaseId/artifact`, `GET /v1/registry/releases/:releaseId/assets/:assetId`, `GET /v1/registry/releases/:releaseId/descriptor`
- Routes writing: `POST /v1/admin/registry/sync`
- API/worker source reads: `services/greenfield-api/src/domains/comments/sticker-service.ts`, `services/greenfield-api/src/domains/moliboos/service.ts`, `services/greenfield-api/src/modules/artifact-closure-service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/gubic-service.ts`, `services/greenfield-api/src/modules/install-descriptor-service.ts`, `services/greenfield-api/src/modules/registry-presentation-service.ts`, `services/greenfield-api/src/modules/registry-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/github-release-sync-service.ts`, `services/greenfield-api/src/product-standard/ingest-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_release_frontends`

- Purpose: module release artifact state
- Primary key: `frontend_id`
- Foreign keys: `ingestion_id -> greenfield_mps_ingestions.ingestion_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `product_id`
- Indexes: `greenfield_release_frontends_ingestion_id_key`, `greenfield_release_frontends_pkey`, `greenfield_release_frontends_product_id_version_key`, `greenfield_release_frontends_release_idx`
- Unique constraints: `greenfield_release_frontends_ingestion_id_key(ingestion_id)`, `greenfield_release_frontends_product_id_version_key(product_id,version)`
- Soft delete: none
- Timestamps: `verified_at`, `created_at`
- Migration introduced: `055_mps_product_frontend_runtime.sql`
- Routes reading: `POST /v1/admin/product-standard/ingest`, `POST /v1/admin/registry/releases/:releaseId/signature`, `POST /v1/admin/registry/releases/:releaseId/verify`, `GET /v1/module-host/:targetProductId/composition`, `GET /v1/modules/:moduleId/frontend`, `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/install-plan`, `GET /v1/modules/:moduleId/installation-descriptor`, `POST /v1/modules/:moduleId/package-install-plan`, `POST /v1/modules/:moduleId/rollback`, `POST /v1/modules/:moduleId/update`, `POST /v1/modules/:moduleId/update-plan`, `PATCH /v1/modules/installations/:installationId/update-policy`, `GET /v1/modules/updates`, `GET /v1/product-standard/products/:productId`, `GET /v1/product-standard/products/:productId/versions/:version`, `GET /v1/registry/releases/:releaseId/descriptor`
- Routes writing: `POST /v1/admin/product-standard/ingest`
- API/worker source reads: `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/extension-fabric-service.ts`, `services/greenfield-api/src/modules/install-descriptor-service.ts`, `services/greenfield-api/src/modules/registry-trust-service.ts`, `services/greenfield-api/src/modules/release-service.ts`, `services/greenfield-api/src/product-standard/frontend-service.ts`, `services/greenfield-api/src/product-standard/ingest-service.ts`, `services/greenfield-worker/src/modules/release-trust-guard.ts`
- API/worker source writes: `services/greenfield-api/src/product-standard/ingest-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_release_presentation_assets`

- Purpose: module release artifact state
- Primary key: `asset_id`
- Foreign keys: `ingestion_id -> greenfield_mps_ingestions.ingestion_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `product_id`
- Indexes: `greenfield_release_presentation_assets_pkey`, `greenfield_release_presentation_assets_release_id_idx`, `greenfield_release_presentation_assets_release_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `054_greenfield_mps_v1_product_contract.sql`
- Routes reading: `POST /v1/admin/product-standard/ingest`, `GET /v1/admin/registry/artifacts/orphans`, `GET /v1/product-standard/products/:productId`, `GET /v1/product-standard/products/:productId/versions/:version`, `GET /v1/registry/releases/:releaseId/assets/:assetId`
- Routes writing: `POST /v1/admin/product-standard/ingest`
- API/worker source reads: `services/greenfield-api/src/modules/artifact-closure-service.ts`, `services/greenfield-api/src/modules/distribution-service.ts`, `services/greenfield-api/src/modules/registry-presentation-service.ts`, `services/greenfield-api/src/modules/registry-trust-service.ts`, `services/greenfield-api/src/product-standard/ingest-service.ts`
- API/worker source writes: `services/greenfield-api/src/product-standard/ingest-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_release_review_checks`

- Purpose: module release artifact state
- Primary key: `review_check_id`
- Foreign keys: `review_submission_id -> greenfield_developer_review_submissions.review_submission_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_release_review_che_review_submission_id_check_ki_key`, `greenfield_release_review_checks_pkey`
- Unique constraints: `greenfield_release_review_che_review_submission_id_check_ki_key(review_submission_id,check_kind)`
- Soft delete: none
- Timestamps: `checked_at`, `created_at`, `updated_at`
- Migration introduced: `048_greenfield_backend_v1_build_release_pipeline.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/developer/products/:productId/reviews`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/developers/service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_repositories`

- Purpose: application state for greenfield repositories
- Primary key: `repository_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_repositories_account_id_name_key`, `greenfield_repositories_pkey`
- Unique constraints: `greenfield_repositories_account_id_name_key(account_id,name)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/accounts/verify-email`, `POST /v1/admin/ops/policy/evaluate`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `GET /v1/repositories/me`, `POST /v1/repositories/me/exports`, `GET /v1/repositories/me/exports/:exportId`, `GET /v1/repositories/me/records`, `POST /v1/repositories/me/records`, `DELETE /v1/repositories/me/records/:recordId`, `GET /v1/repositories/me/records/:recordId`, `PATCH /v1/repositories/me/records/:recordId`
- Routes writing: `POST /v1/accounts/verify-email`, `POST /v1/repositories/me/records`, `DELETE /v1/repositories/me/records/:recordId`, `PATCH /v1/repositories/me/records/:recordId`
- API/worker source reads: `services/greenfield-api/src/accounts/service.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/records/service.ts`, `services/greenfield-api/src/repositories/service.ts`
- API/worker source writes: `services/greenfield-api/src/accounts/service.ts`, `services/greenfield-api/src/records/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_repository_exports`

- Purpose: application state for greenfield repository exports
- Primary key: `export_id`
- Foreign keys: `repository_id -> greenfield_repositories.repository_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_repository_exports_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `expires_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `GET /v1/repositories/me/exports/:exportId`
- Routes writing: `POST /v1/repositories/me/exports`
- API/worker source reads: `services/greenfield-api/src/repositories/service.ts`
- API/worker source writes: `services/greenfield-api/src/repositories/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_reserved_handles`

- Purpose: application state for greenfield reserved handles
- Primary key: `handle`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_reserved_handles_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/accounts/handle.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_reserved_identifiers`

- Purpose: application state for greenfield reserved identifiers
- Primary key: `identifier`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_reserved_identifiers_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `034_phase7i_f5b_mail_identity.sql`
- Routes reading: `GET /v1/accounts/mail-local-parts/:localPart/availability`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/accounts/handle.ts`, `services/greenfield-api/src/mail/identity-service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_runtime_session_events`

- Purpose: application state for greenfield runtime session events
- Primary key: `event_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `session_id -> greenfield_runtime_sessions.session_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_runtime_session_events_account_idx`, `greenfield_runtime_session_events_pkey`, `greenfield_runtime_session_events_session_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `015_phase7d_runtime_sessions.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/runtime/session-store.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_runtime_sessions`

- Purpose: application state for greenfield runtime sessions
- Primary key: `session_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `account_id`, `module_id`, `installation_id`
- Indexes: `greenfield_runtime_sessions_account_idx`, `greenfield_runtime_sessions_module_idx`, `greenfield_runtime_sessions_pkey`, `greenfield_runtime_sessions_provider_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `started_at`, `terminated_at`
- Migration introduced: `015_phase7d_runtime_sessions.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/runtime/session-store.ts`
- API/worker source writes: `services/greenfield-api/src/runtime/session-store.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_saved_collection_items`

- Purpose: application state for greenfield saved collection items
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `087_greenfield_collections_and_drafts.sql`
- Routes reading: `GET /v1/me/collections`, `GET /v1/me/collections/:collectionId`, `PATCH /v1/me/collections/:collectionId`, `GET /v1/me/collections/:collectionId/items`, `POST /v1/me/collections/:collectionId/items`
- Routes writing: `POST /v1/me/collections/:collectionId/items`, `DELETE /v1/me/collections/:collectionId/items/:itemId`
- API/worker source reads: `services/greenfield-api/src/domains/collections/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/collections/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_saved_collections`

- Purpose: application state for greenfield saved collections
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `087_greenfield_collections_and_drafts.sql`
- Routes reading: `GET /v1/me/collections`, `GET /v1/me/collections/:collectionId`, `PATCH /v1/me/collections/:collectionId`, `GET /v1/me/collections/:collectionId/items`, `POST /v1/me/collections/:collectionId/items`, `DELETE /v1/me/collections/:collectionId/items/:itemId`
- Routes writing: `POST /v1/me/collections`, `DELETE /v1/me/collections/:collectionId`, `PATCH /v1/me/collections/:collectionId`, `POST /v1/me/collections/:collectionId/items`, `DELETE /v1/me/collections/:collectionId/items/:itemId`
- API/worker source reads: `services/greenfield-api/src/domains/collections/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/collections/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_schema_versions`

- Purpose: application state for greenfield schema versions
- Primary key: `schema_version_id`
- Foreign keys: `schema_id -> greenfield_schemas.schema_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_schema_versions_pkey`, `greenfield_schema_versions_schema_id_version_key`
- Unique constraints: `greenfield_schema_versions_schema_id_version_key(schema_id,version)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `greenfield_schemas`

- Purpose: application state for greenfield schemas
- Primary key: `schema_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_schemas_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-worker/src/modules/schema-registration-handler.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_security_events`

- Purpose: application state for greenfield security events
- Primary key: `event_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `method_id -> greenfield_authentication_methods.method_id`, `session_id -> greenfield_sessions.session_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_security_events_account_idx`, `greenfield_security_events_pkey`, `greenfield_security_events_type_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `031_phase7i_f5_auth_domain.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/auth/security-events/service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_session_events`

- Purpose: application state for greenfield session events
- Primary key: `event_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `session_id -> greenfield_sessions.session_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_session_events_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/accounts/me/password`, `DELETE /v1/accounts/me/sessions`, `POST /v1/accounts/recovery/complete`, `POST /v1/accounts/reset-password`, `POST /v1/auth/step-up/totp`, `DELETE /v1/sessions/:sessionId`, `DELETE /v1/sessions/current`, `POST /v1/sessions/passkey`, `POST /v1/sessions/refresh`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/accounts/recovery.ts`, `services/greenfield-api/src/accounts/service.ts`, `services/greenfield-api/src/sessions/service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_session_tokens`

- Purpose: application state for greenfield session tokens
- Primary key: `token_id`
- Foreign keys: `session_id -> greenfield_sessions.session_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_session_tokens_pkey`, `greenfield_session_tokens_session_idx`, `greenfield_session_tokens_token_hash_key`
- Unique constraints: `greenfield_session_tokens_token_hash_key(token_hash)`
- Soft delete: none
- Timestamps: `expires_at`, `rotated_at`, `reused_at`, `revoked_at`, `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/sessions/refresh`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/accounts/me/password`, `DELETE /v1/accounts/me/sessions`, `DELETE /v1/sessions/:sessionId`, `DELETE /v1/sessions/current`, `POST /v1/sessions/passkey`, `POST /v1/sessions/refresh`
- API/worker source reads: `services/greenfield-api/src/sessions/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/sessions/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_sessions`

- Purpose: application state for greenfield sessions
- Primary key: `session_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `authentication_method_id -> greenfield_authentication_methods.method_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_sessions_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `expires_at`, `revoked_at`, `last_seen_at`, `recent_authentication_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/accounts/me/password`, `DELETE /v1/accounts/me/sessions`, `GET /v1/accounts/me/sessions`, `DELETE /v1/sessions/:sessionId`, `DELETE /v1/sessions/current`, `POST /v1/sessions/refresh`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/accounts/me/password`, `DELETE /v1/accounts/me/sessions`, `POST /v1/accounts/recovery/complete`, `POST /v1/accounts/reset-password`, `POST /v1/auth/step-up/password`, `POST /v1/auth/step-up/totp`, `DELETE /v1/sessions/:sessionId`, `DELETE /v1/sessions/current`, `POST /v1/sessions/passkey`, `POST /v1/sessions/refresh`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/sessions/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/accounts/recovery.ts`, `services/greenfield-api/src/sessions/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_sticker_pack_releases`

- Purpose: application state for greenfield sticker pack releases
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `084_moliboo_signed_packs.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/comments/sticker-service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_stickers`

- Purpose: application state for greenfield stickers
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `084_moliboo_signed_packs.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/comments/sticker-service.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `greenfield_story_groups`

- Purpose: application state for greenfield story groups
- Primary key: `group_id`
- Foreign keys: `owner_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `owner_actor_id`
- Indexes: `greenfield_story_groups_active_idx`, `greenfield_story_groups_owner_idx`, `greenfield_story_groups_pkey`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `expires_at`, `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `028_phase7f_stories.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/creator/insights`, `GET /v1/media/stories/:mediaFile`, `POST /v1/reports`, `POST /v1/stories`, `GET /v1/stories/:groupId`, `POST /v1/stories/:storyId/replies`, `DELETE /v1/stories/items/:itemId`, `POST /v1/stories/items/:itemId/viewed`, `GET /v1/stories/rail`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/admin/moderation/reports/:reportId/actions`, `POST /v1/stories`, `DELETE /v1/stories/items/:itemId`
- API/worker source reads: `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/app/register-phase7f-stories-routes.ts`, `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/stories/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/stories/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_story_items`

- Purpose: application state for greenfield story items
- Primary key: `item_id`
- Foreign keys: `group_id -> greenfield_story_groups.group_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_story_items_group_idx`, `greenfield_story_items_pkey`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `created_at`, `deleted_at`
- Migration introduced: `028_phase7f_stories.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/creator/insights`, `GET /v1/media/stories/:mediaFile`, `POST /v1/reports`, `POST /v1/stories`, `GET /v1/stories/:groupId`, `POST /v1/stories/:storyId/replies`, `DELETE /v1/stories/items/:itemId`, `POST /v1/stories/items/:itemId/viewed`, `GET /v1/stories/rail`
- Routes writing: `POST /v1/admin/moderation/reports/:reportId/actions`, `POST /v1/stories`, `DELETE /v1/stories/items/:itemId`
- API/worker source reads: `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/app/register-phase7f-stories-routes.ts`, `services/greenfield-api/src/domains/comments/media.ts`, `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/stories/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/stories/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_story_views`

- Purpose: application state for greenfield story views
- Primary key: `view_id`
- Foreign keys: `item_id -> greenfield_story_items.item_id`, `viewer_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `viewer_actor_id`
- Indexes: `greenfield_story_views_item_id_viewer_actor_id_key`, `greenfield_story_views_pkey`, `greenfield_story_views_viewer_idx`
- Unique constraints: `greenfield_story_views_item_id_viewer_actor_id_key(item_id,viewer_actor_id)`
- Soft delete: none
- Timestamps: `viewed_at`
- Migration introduced: `028_phase7f_stories.sql`
- Routes reading: `GET /v1/creator/insights`, `POST /v1/stories`, `GET /v1/stories/:groupId`, `GET /v1/stories/rail`
- Routes writing: `POST /v1/stories/items/:itemId/viewed`
- API/worker source reads: `services/greenfield-api/src/domains/stories/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/stories/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_support_cases`

- Purpose: application state for greenfield support cases
- Primary key: `case_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_support_cases_account_id_idempotency_key_key`, `greenfield_support_cases_account_idx`, `greenfield_support_cases_pkey`, `greenfield_support_cases_reference_key`
- Unique constraints: `greenfield_support_cases_account_id_idempotency_key_key(account_id,idempotency_key)`, `greenfield_support_cases_reference_key(reference)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `062_public_status_support_cases.sql`
- Routes reading: `GET /v1/support/cases`, `POST /v1/support/cases`
- Routes writing: `POST /v1/support/cases`
- API/worker source reads: `services/greenfield-api/src/support/service.ts`
- API/worker source writes: `services/greenfield-api/src/support/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_tools`

- Purpose: application state for greenfield tools
- Primary key: `tool_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_tools_pkey`, `greenfield_tools_slug_key`
- Unique constraints: `greenfield_tools_slug_key(slug)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `GET /v1/tools`, `GET /v1/tools/:toolId`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/app/register-routes.ts`
- API/worker source writes: `services/greenfield-api/src/tools/seed.ts`, `services/greenfield-worker/src/modules/contribution-registration-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_totp_credentials`

- Purpose: application state for greenfield totp credentials
- Primary key: `totp_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `method_id -> greenfield_authentication_methods.method_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `greenfield_totp_credentials_account_idx`, `greenfield_totp_credentials_method_id_key`, `greenfield_totp_credentials_pkey`
- Unique constraints: `greenfield_totp_credentials_method_id_key(method_id)`
- Soft delete: none
- Timestamps: `confirmed_at`, `last_used_at`, `created_at`, `updated_at`, `revoked_at`
- Migration introduced: `031_phase7i_f5_auth_domain.sql`
- Routes reading: `POST /v1/auth/step-up/totp`, `POST /v1/auth/totp/disable`, `POST /v1/auth/totp/verify`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/auth/step-up/totp`, `POST /v1/auth/totp/disable`, `POST /v1/auth/totp/enroll`, `POST /v1/auth/totp/verify`
- API/worker source reads: `services/greenfield-api/src/auth/mfa/totp.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/auth/mfa/totp.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_usage_events`

- Purpose: application state for greenfield usage events
- Primary key: `usage_event_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `entitlement_id -> greenfield_entitlements.entitlement_id`, `installation_id -> greenfield_extension_installations.installation_id`, `organisation_id -> greenfield_developer_organisations.organisation_id`
- Ownership/workspace/user/module columns: `account_id`, `product_id`, `installation_id`
- Indexes: `greenfield_usage_events_account_idx`, `greenfield_usage_events_pkey`, `greenfield_usage_events_producer_service_id_idempotency_key_key`, `greenfield_usage_events_product_idx`
- Unique constraints: `greenfield_usage_events_producer_service_id_idempotency_key_key(producer_service_id,idempotency_key)`
- Soft delete: none
- Timestamps: `occurred_at`, `recorded_at`
- Migration introduced: `049_greenfield_backend_v1_entitlements_usage.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/backend/products/:productId/usage`
- Routes writing: `POST /v1/backend/products/:productId/usage`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/entitlements/service.ts`
- API/worker source writes: `services/greenfield-api/src/entitlements/service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_verification_appeals`

- Purpose: application state for greenfield verification appeals
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `076_greenfield_premium_entitlements.sql`
- Routes reading: `POST /v1/admin/qa/verification/appeals/:appealId/transitions`, `POST /v1/admin/qa/verification/applications/:applicationId/transitions`, `GET /v1/me/verification`, `POST /v1/me/verification/applications`, `POST /v1/me/verification/applications/:applicationId/appeals`
- Routes writing: `POST /v1/admin/qa/verification/appeals/:appealId/transitions`, `POST /v1/me/verification/applications/:applicationId/appeals`
- API/worker source reads: `services/greenfield-api/src/premium/verification-service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/verification-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_verification_applications`

- Purpose: application state for greenfield verification applications
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `076_greenfield_premium_entitlements.sql`
- Routes reading: `POST /v1/admin/qa/verification/appeals/:appealId/transitions`, `GET /v1/admin/qa/verification/applications`, `POST /v1/admin/qa/verification/applications/:applicationId/transitions`, `GET /v1/me/verification`, `POST /v1/me/verification/applications`, `POST /v1/me/verification/applications/:applicationId/appeals`
- Routes writing: `POST /v1/admin/qa/verification/appeals/:appealId/transitions`, `POST /v1/admin/qa/verification/applications/:applicationId/transitions`, `POST /v1/me/verification/applications`
- API/worker source reads: `services/greenfield-api/src/premium/verification-service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/verification-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_verification_events`

- Purpose: application state for greenfield verification events
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `076_greenfield_premium_entitlements.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/qa/verification/appeals/:appealId/transitions`, `POST /v1/admin/qa/verification/applications/:applicationId/transitions`, `POST /v1/me/verification/applications`, `POST /v1/me/verification/applications/:applicationId/appeals`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/premium/verification-service.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `greenfield_verification_statuses`

- Purpose: application state for greenfield verification statuses
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `076_greenfield_premium_entitlements.sql`
- Routes reading: `POST /v1/admin/qa/verification/appeals/:appealId/transitions`, `POST /v1/admin/qa/verification/applications/:applicationId/transitions`, `GET /v1/me/verification`, `POST /v1/me/verification/applications`, `POST /v1/me/verification/applications/:applicationId/appeals`
- Routes writing: `POST /v1/admin/qa/verification/appeals/:appealId/transitions`, `POST /v1/admin/qa/verification/applications/:applicationId/transitions`, `POST /v1/me/verification/applications`
- API/worker source reads: `services/greenfield-api/src/premium/badges.ts`, `services/greenfield-api/src/premium/verification-service.ts`
- API/worker source writes: `services/greenfield-api/src/premium/verification-service.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_widgets`

- Purpose: application state for greenfield widgets
- Primary key: `widget_id`
- Foreign keys: `extension_version_id -> greenfield_extension_versions.extension_version_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_widgets_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `004_greenfield_sovereign_core.sql`
- Routes reading: `GET /v1/widgets`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/app/register-routes.ts`
- API/worker source writes: `services/greenfield-worker/src/modules/contribution-registration-handler.ts`
- Disposition: active read/write or ledger/schema table

### `greenfield_worker_heartbeats`

- Purpose: application state for greenfield worker heartbeats
- Primary key: `worker_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `greenfield_worker_heartbeats_pkey`, `greenfield_worker_heartbeats_seen_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `started_at`, `last_seen_at`
- Migration introduced: `062_public_status_support_cases.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/system/status.ts`
- API/worker source writes: `services/greenfield-worker/src/heartbeat/heartbeat.ts`
- Disposition: active read/write or ledger/schema table

### `idempotency_keys`

- Purpose: application state for idempotency keys
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `idempotency_keys_actor_id_key_key`, `idempotency_keys_pkey`
- Unique constraints: `idempotency_keys_actor_id_key_key(actor_id,key)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `expires_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `POST /v1/stories/:storyId/replies`
- Routes writing: `POST /v1/stories/:storyId/replies`
- API/worker source reads: `services/greenfield-api/src/backend-fabric/routes.ts`, `services/greenfield-api/src/domains/stories/service.ts`
- API/worker source writes: `services/greenfield-api/src/backend-fabric/routes.ts`, `services/greenfield-api/src/domains/stories/service.ts`
- Disposition: active read/write or ledger/schema table

### `intelligence_aki_decisions`

- Purpose: application state for intelligence aki decisions
- Primary key: `decision_id`
- Foreign keys: `mission_id -> intelligence_missions.mission_id`, `proposal_id -> intelligence_proposals.proposal_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `intelligence_aki_decisions_pkey`, `intelligence_aki_mission_idx`, `intelligence_aki_proposal_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: active read/write or ledger/schema table

### `intelligence_approvals`

- Purpose: application state for intelligence approvals
- Primary key: `approval_id`
- Foreign keys: `mission_id -> intelligence_missions.mission_id`, `proposal_id -> intelligence_proposals.proposal_id`, `requested_account_id -> greenfield_accounts.account_id`, `resolver_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `requested_account_id`, `resolver_account_id`
- Indexes: `intelligence_approvals_mission_idx`, `intelligence_approvals_owner_status_idx`, `intelligence_approvals_pkey`, `intelligence_approvals_proposal_id_key`
- Unique constraints: `intelligence_approvals_proposal_id_key(proposal_id)`
- Soft delete: none
- Timestamps: `requested_at`, `resolved_at`, `expires_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: active read/write or ledger/schema table

### `intelligence_artifacts`

- Purpose: application state for intelligence artifacts
- Primary key: `artifact_id`
- Foreign keys: `execution_id -> intelligence_runs.execution_id`, `mission_id -> intelligence_missions.mission_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `intelligence_artifacts_mission_idx`, `intelligence_artifacts_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: active read/write or ledger/schema table

### `intelligence_circuit_revisions`

- Purpose: application state for intelligence circuit revisions
- Primary key: `revision_id`
- Foreign keys: `circuit_id -> intelligence_circuits.circuit_id`, `created_by_account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `created_by_account_id`
- Indexes: `intelligence_circuit_revisions_circuit_id_version_key`, `intelligence_circuit_revisions_pkey`
- Unique constraints: `intelligence_circuit_revisions_circuit_id_version_key(circuit_id,version)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `intelligence_circuits`

- Purpose: application state for intelligence circuits
- Primary key: `circuit_id`
- Foreign keys: `active_revision_id -> intelligence_circuit_revisions.revision_id`, `owner_account_id -> greenfield_accounts.account_id`, `workspace_id -> greenfield_developer_organisations.organisation_id`
- Ownership/workspace/user/module columns: `owner_account_id`, `workspace_id`
- Indexes: `intelligence_circuits_owner_state_idx`, `intelligence_circuits_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `intelligence_evidence`

- Purpose: application state for intelligence evidence
- Primary key: `evidence_id`
- Foreign keys: `mission_id -> intelligence_missions.mission_id`, `proposal_id -> intelligence_proposals.proposal_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `intelligence_evidence_mission_idx`, `intelligence_evidence_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `captured_at`, `created_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: active read/write or ledger/schema table

### `intelligence_governor_decisions`

- Purpose: application state for intelligence governor decisions
- Primary key: `governor_decision_id`
- Foreign keys: `aki_decision_id -> intelligence_aki_decisions.decision_id`, `mission_id -> intelligence_missions.mission_id`, `proposal_id -> intelligence_proposals.proposal_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `intelligence_governor_decisions_pkey`, `intelligence_governor_mission_idx`, `intelligence_governor_proposal_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: active read/write or ledger/schema table

### `intelligence_ledger_events`

- Purpose: application state for intelligence ledger events
- Primary key: `event_id`
- Foreign keys: `aki_decision_id -> intelligence_aki_decisions.decision_id`, `approval_id -> intelligence_approvals.approval_id`, `artifact_id -> intelligence_artifacts.artifact_id`, `execution_id -> intelligence_runs.execution_id`, `governor_decision_id -> intelligence_governor_decisions.governor_decision_id`, `mission_id -> intelligence_missions.mission_id`, `owner_account_id -> greenfield_accounts.account_id`, `proposal_id -> intelligence_proposals.proposal_id`, `workspace_id -> greenfield_developer_organisations.organisation_id`
- Ownership/workspace/user/module columns: `actor_id`, `owner_account_id`, `workspace_id`
- Indexes: `intelligence_ledger_correlation_idx`, `intelligence_ledger_events_pkey`, `intelligence_ledger_mission_time_idx`, `intelligence_ledger_owner_time_idx`, `intelligence_ledger_type_time_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `occurred_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/intelligence/mission-cancel.ts`, `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-cancel.ts`, `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: active read/write or ledger/schema table

### `intelligence_missions`

- Purpose: application state for intelligence missions
- Primary key: `mission_id`
- Foreign keys: `owner_account_id -> greenfield_accounts.account_id`, `workspace_id -> greenfield_developer_organisations.organisation_id`
- Ownership/workspace/user/module columns: `owner_account_id`, `workspace_id`
- Indexes: `intelligence_missions_correlation_idx`, `intelligence_missions_owner_status_idx`, `intelligence_missions_pkey`, `intelligence_missions_workspace_status_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `completed_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/intelligence/mission-cancel.ts`, `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-cancel.ts`, `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: active read/write or ledger/schema table

### `intelligence_plan_steps`

- Purpose: application state for intelligence plan steps
- Primary key: `step_id`
- Foreign keys: `mission_id -> intelligence_missions.mission_id`, `plan_id -> intelligence_plans.plan_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `intelligence_plan_steps_pkey`, `intelligence_plan_steps_plan_id_order_index_key`
- Unique constraints: `intelligence_plan_steps_plan_id_order_index_key(plan_id,order_index)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: active read/write or ledger/schema table

### `intelligence_plans`

- Purpose: application state for intelligence plans
- Primary key: `plan_id`
- Foreign keys: `mission_id -> intelligence_missions.mission_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `intelligence_plans_mission_id_version_key`, `intelligence_plans_mission_idx`, `intelligence_plans_pkey`
- Unique constraints: `intelligence_plans_mission_id_version_key(mission_id,version)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: active read/write or ledger/schema table

### `intelligence_proposals`

- Purpose: application state for intelligence proposals
- Primary key: `proposal_id`
- Foreign keys: `mission_id -> intelligence_missions.mission_id`, `plan_id -> intelligence_plans.plan_id`, `step_id -> intelligence_plan_steps.step_id`
- Ownership/workspace/user/module columns: `module_id`
- Indexes: `intelligence_proposals_capability_idx`, `intelligence_proposals_idempotency_idx`, `intelligence_proposals_mission_id_proposal_id_key`, `intelligence_proposals_mission_idx`, `intelligence_proposals_pkey`
- Unique constraints: `intelligence_proposals_mission_id_proposal_id_key(mission_id,proposal_id)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: active read/write or ledger/schema table

### `intelligence_run_steps`

- Purpose: application state for intelligence run steps
- Primary key: `run_step_id`
- Foreign keys: `execution_id -> intelligence_runs.execution_id`, `plan_step_id -> intelligence_plan_steps.step_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `intelligence_run_steps_execution_id_plan_step_id_key`, `intelligence_run_steps_pkey`
- Unique constraints: `intelligence_run_steps_execution_id_plan_step_id_key(execution_id,plan_step_id)`
- Soft delete: none
- Timestamps: `started_at`, `completed_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `intelligence_runs`

- Purpose: application state for intelligence runs
- Primary key: `execution_id`
- Foreign keys: `approval_id -> intelligence_approvals.approval_id`, `governor_decision_id -> intelligence_governor_decisions.governor_decision_id`, `mission_id -> intelligence_missions.mission_id`, `proposal_id -> intelligence_proposals.proposal_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `intelligence_runs_idempotency_idx`, `intelligence_runs_mission_id_proposal_id_idempotency_key_key`, `intelligence_runs_mission_status_idx`, `intelligence_runs_pkey`, `intelligence_runs_proposal_id_key`
- Unique constraints: `intelligence_runs_mission_id_proposal_id_idempotency_key_key(mission_id,proposal_id,idempotency_key)`, `intelligence_runs_proposal_id_key(proposal_id)`
- Soft delete: none
- Timestamps: `started_at`, `completed_at`, `created_at`
- Migration introduced: `056_gai01_governed_intelligence.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- API/worker source writes: `services/greenfield-api/src/intelligence/mission-runtime-store.ts`, `services/greenfield-api/src/intelligence/repository.ts`
- Disposition: active read/write or ledger/schema table

### `job_failures`

- Purpose: application state for job failures
- Primary key: `id`
- Foreign keys: `job_id -> background_jobs.id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `job_failures_job_idx`, `job_failures_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/notifications/reaction-dead-letter-retry.ts`
- API/worker source writes: `services/greenfield-api/src/backend-fabric/event-job-service.ts`, `services/greenfield-worker/src/extensions/plugin-lifecycle.ts`, `services/greenfield-worker/src/jobs/claim.ts`
- Disposition: active read/write or ledger/schema table

### `moderation_actions`

- Purpose: application state for moderation actions
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`, `report_id -> reports.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `moderation_actions_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: none observed
- Routes writing: `PATCH /v1/admin/moderation/reports/:reportId`, `POST /v1/admin/moderation/reports/:reportId/actions`
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/domains/moderation/repository.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `module_backend_capabilities`

- Purpose: application state for module backend capabilities
- Primary key: `capability_id`
- Foreign keys: `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `installation_id`, `module_id`
- Indexes: `module_backend_capabilities_installation_id_capability_prov_key`, `module_backend_capabilities_pkey`
- Unique constraints: `module_backend_capabilities_installation_id_capability_prov_key(installation_id,capability,provider)`
- Soft delete: none
- Timestamps: `updated_at`
- Migration introduced: `023_phase7e_module_backend_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/modules/backend/repository.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `module_backend_definitions`

- Purpose: application state for module backend definitions
- Primary key: `definition_id`
- Foreign keys: `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `module_id`
- Indexes: `module_backend_definitions_module_idx`, `module_backend_definitions_pkey`, `module_backend_definitions_release_id_key`
- Unique constraints: `module_backend_definitions_release_id_key(release_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `023_phase7e_module_backend_runtime.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/admin/registry/modules/import`
- API/worker source reads: `services/greenfield-api/src/modules/backend/repository.ts`
- API/worker source writes: `services/greenfield-api/src/modules/backend/repository.ts`, `services/greenfield-api/src/modules/release-service.ts`
- Disposition: active read/write or ledger/schema table

### `module_backend_event_deliveries`

- Purpose: application state for module backend event deliveries
- Primary key: `delivery_id`
- Foreign keys: `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `installation_id`, `module_id`
- Indexes: `module_backend_event_deliveri_installation_id_event_id_dire_key`, `module_backend_event_deliveries_pkey`
- Unique constraints: `module_backend_event_deliveri_installation_id_event_id_dire_key(installation_id,event_id,direction)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `023_phase7e_module_backend_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/backend/repository.ts`
- API/worker source writes: `services/greenfield-api/src/modules/backend/repository.ts`
- Disposition: active read/write or ledger/schema table

### `module_backend_event_subscriptions`

- Purpose: application state for module backend event subscriptions
- Primary key: `subscription_id`
- Foreign keys: `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `installation_id`, `module_id`
- Indexes: `module_backend_event_subscrip_installation_id_event_type_di_key`, `module_backend_event_subscriptions_pkey`
- Unique constraints: `module_backend_event_subscrip_installation_id_event_type_di_key(installation_id,event_type,direction)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `023_phase7e_module_backend_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `module_backend_failures`

- Purpose: application state for module backend failures
- Primary key: `failure_id`
- Foreign keys: `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `installation_id`, `module_id`
- Indexes: `module_backend_failures_module_idx`, `module_backend_failures_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `occurred_at`
- Migration introduced: `023_phase7e_module_backend_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: `services/greenfield-api/src/modules/backend/repository.ts`
- Disposition: WRITE-ONLY CANDIDATE

### `module_backend_health`

- Purpose: application state for module backend health
- Primary key: `health_id`
- Foreign keys: `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `installation_id`, `module_id`
- Indexes: `module_backend_health_installation_idx`, `module_backend_health_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `checked_at`
- Migration introduced: `023_phase7e_module_backend_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/backend/repository.ts`
- API/worker source writes: `services/greenfield-api/src/modules/backend/repository.ts`
- Disposition: active read/write or ledger/schema table

### `module_backend_installations`

- Purpose: application state for module backend installations
- Primary key: `backend_installation_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`, `release_id -> greenfield_module_releases.release_id`
- Ownership/workspace/user/module columns: `backend_installation_id`, `installation_id`, `account_id`, `module_id`
- Indexes: `module_backend_installations_account_idx`, `module_backend_installations_installation_id_key`, `module_backend_installations_pkey`
- Unique constraints: `module_backend_installations_installation_id_key(installation_id)`
- Soft delete: none
- Timestamps: `last_verified_at`, `last_health_at`, `enabled_at`, `disabled_at`, `created_at`, `updated_at`
- Migration introduced: `023_phase7e_module_backend_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/backend/repository.ts`
- API/worker source writes: `services/greenfield-api/src/modules/backend/repository.ts`
- Disposition: active read/write or ledger/schema table

### `module_backend_sessions`

- Purpose: application state for module backend sessions
- Primary key: `session_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `installation_id`, `module_id`, `account_id`, `actor_id`
- Indexes: `module_backend_sessions_installation_idx`, `module_backend_sessions_pkey`, `module_backend_sessions_token_hash_key`
- Unique constraints: `module_backend_sessions_token_hash_key(token_hash)`
- Soft delete: none
- Timestamps: `issued_at`, `expires_at`, `revoked_at`, `created_at`
- Migration introduced: `023_phase7e_module_backend_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/backend/token-service.ts`
- API/worker source writes: `services/greenfield-api/src/modules/backend/repository.ts`
- Disposition: active read/write or ledger/schema table

### `module_backend_webhook_deliveries`

- Purpose: application state for module backend webhook deliveries
- Primary key: `webhook_delivery_id`
- Foreign keys: `installation_id -> greenfield_extension_installations.installation_id`
- Ownership/workspace/user/module columns: `installation_id`, `module_id`
- Indexes: `module_backend_webhook_delive_installation_id_webhook_id_id_key`, `module_backend_webhook_deliveries_pkey`
- Unique constraints: `module_backend_webhook_delive_installation_id_webhook_id_id_key(installation_id,webhook_id,idempotency_key)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `023_phase7e_module_backend_runtime.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/modules/backend/repository.ts`
- API/worker source writes: `services/greenfield-api/src/modules/backend/repository.ts`
- Disposition: active read/write or ledger/schema table

### `mutes`

- Purpose: application state for mutes
- Primary key: `id`
- Foreign keys: `muted_actor_id -> actors.id`, `muter_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `muter_actor_id`, `muted_actor_id`
- Indexes: `mutes_muter_actor_id_muted_actor_id_key`, `mutes_muter_idx`, `mutes_pkey`
- Unique constraints: `mutes_muter_actor_id_muted_actor_id_key(muter_actor_id,muted_actor_id)`
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `GET /v1/accounts/me/mutes`, `GET /v1/activity`, `GET /v1/comments/:commentId/replies`, `GET /v1/discover`, `GET /v1/feed/home`, `GET /v1/notifications`, `GET /v1/posts/:postId/comments`, `POST /v1/profiles/:profileId/mute`, `GET /v1/reels`
- Routes writing: `DELETE /v1/profiles/:profileId/mute`, `POST /v1/profiles/:profileId/mute`
- API/worker source reads: `services/greenfield-api/src/domains/comments/service.ts`, `services/greenfield-api/src/domains/discovery/repository.ts`, `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/notifications/repository.ts`, `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moderation/repository.ts`
- Disposition: active read/write or ledger/schema table

### `notification_preferences`

- Purpose: application state for notification preferences
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `notification_preferences_actor_id_key`, `notification_preferences_pkey`
- Unique constraints: `notification_preferences_actor_id_key(actor_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `GET /v1/accounts/me/notification-preferences`, `PATCH /v1/accounts/me/notification-preferences`
- Routes writing: `GET /v1/accounts/me/notification-preferences`, `PATCH /v1/accounts/me/notification-preferences`
- API/worker source reads: `services/greenfield-api/src/domains/notifications/preferences.ts`, `services/greenfield-worker/src/digests/digests.ts`, `services/greenfield-worker/src/notifications/create.ts`, `services/greenfield-worker/src/notifications/social.ts`
- API/worker source writes: `services/greenfield-api/src/domains/notifications/preferences.ts`
- Disposition: active read/write or ledger/schema table

### `notifications`

- Purpose: application state for notifications
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`, `recipient_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `recipient_actor_id`, `actor_id`
- Indexes: `notifications_category_created_idx`, `notifications_pkey`, `notifications_recipient_created_idx`, `notifications_recipient_dedupe_uidx`, `notifications_recipient_unread_idx`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `read_at`, `created_at`, `updated_at`, `deleted_at`, `aggregate_window_started_at`, `last_aggregated_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `GET /v1/notifications`
- Routes writing: `POST /v1/notifications/:notificationId/read`, `POST /v1/notifications/read-all`
- API/worker source reads: `services/greenfield-api/src/domains/notifications/repository.ts`, `services/greenfield-worker/src/digests/digests.ts`, `services/greenfield-worker/src/notifications/create.ts`, `services/greenfield-worker/src/push/dispatch.ts`
- API/worker source writes: `services/greenfield-api/src/domains/notifications/repository.ts`, `services/greenfield-worker/src/notifications/create.ts`, `services/greenfield-worker/src/notifications/social.ts`
- Disposition: active read/write or ledger/schema table

### `operational_controls`

- Purpose: application state for operational controls
- Primary key: `key`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `operational_controls_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `updated_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-worker/src/bridges/atproto/session.ts`
- API/worker source writes: `services/greenfield-api/src/app/register-routes.ts`
- Disposition: active read/write or ledger/schema table

### `outbox_events`

- Purpose: application state for outbox events
- Primary key: `id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `outbox_events_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `published_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/repositories/me/records`, `DELETE /v1/repositories/me/records/:recordId`, `PATCH /v1/repositories/me/records/:recordId`
- API/worker source reads: `services/greenfield-worker/src/outbox/drain.ts`
- API/worker source writes: `services/greenfield-api/src/domains/outbox/repository.ts`, `services/greenfield-api/src/records/service.ts`, `services/greenfield-worker/src/outbox/drain.ts`
- Disposition: active read/write or ledger/schema table

### `post_content`

- Purpose: application state for post content
- Primary key: `content_id`
- Foreign keys: `attachment_id -> attachments.attachment_id`, `post_id -> posts.id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `post_content_attachment_idx`, `post_content_pkey`, `post_content_post_id_attachment_id_key`, `post_content_post_id_sort_order_key`, `post_content_post_order_idx`
- Unique constraints: `post_content_post_id_attachment_id_key(post_id,attachment_id)`, `post_content_post_id_sort_order_key(post_id,sort_order)`
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `057_post04_attachment_platform.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/feed/home`, `GET /v1/feed/profile/:profileId`, `GET /v1/media/:mediaFile`, `GET /v1/posts/:postId`, `DELETE /v1/posts/:postId/like`, `POST /v1/posts/:postId/like`, `DELETE /v1/posts/:postId/repost`, `POST /v1/posts/:postId/repost`, `DELETE /v1/posts/:postId/save`, `POST /v1/posts/:postId/save`, `GET /v1/profiles/:handle/posts`
- Routes writing: `POST /v1/posts`
- API/worker source reads: `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/domains/comments/media.ts`, `services/greenfield-api/src/domains/posts/repository.ts`
- API/worker source writes: `services/greenfield-api/src/domains/posts/writes.ts`
- Disposition: active read/write or ledger/schema table

### `post_likes`

- Purpose: application state for post likes
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`, `post_id -> posts.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `post_likes_actor_id_post_id_key`, `post_likes_pkey`
- Unique constraints: `post_likes_actor_id_post_id_key(actor_id,post_id)`
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `GET /v1/creator/insights`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/settings-v2/service.ts`, `services/greenfield-worker/src/digests/digests.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `post_media`

- Purpose: application state for post media
- Primary key: `id`
- Foreign keys: `post_id -> posts.id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `post_media_pkey`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/discover`, `GET /v1/feed/home`, `GET /v1/feed/profile/:profileId`, `GET /v1/media/:mediaFile`, `GET /v1/posts/:postId`, `DELETE /v1/posts/:postId/like`, `POST /v1/posts/:postId/like`, `DELETE /v1/posts/:postId/repost`, `POST /v1/posts/:postId/repost`, `DELETE /v1/posts/:postId/save`, `POST /v1/posts/:postId/save`, `GET /v1/profiles/:handle/posts`
- Routes writing: `POST /v1/posts`
- API/worker source reads: `services/greenfield-api/src/app/register-routes.ts`, `services/greenfield-api/src/domains/discovery/repository.ts`, `services/greenfield-api/src/domains/posts/repository.ts`, `services/greenfield-worker/src/search/post-projector.ts`
- API/worker source writes: `services/greenfield-api/src/domains/posts/writes.ts`
- Disposition: active read/write or ledger/schema table

### `post_reposts`

- Purpose: application state for post reposts
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`, `post_id -> posts.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `post_reposts_actor_id_post_id_key`, `post_reposts_pkey`
- Unique constraints: `post_reposts_actor_id_post_id_key(actor_id,post_id)`
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/feed/home`, `GET /v1/feed/profile/:profileId`, `GET /v1/media/:mediaFile`, `GET /v1/posts/:postId`, `DELETE /v1/posts/:postId/like`, `POST /v1/posts/:postId/like`, `DELETE /v1/posts/:postId/repost`, `POST /v1/posts/:postId/repost`, `DELETE /v1/posts/:postId/save`, `POST /v1/posts/:postId/save`, `GET /v1/profiles/:handle/posts`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/posts/repository.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `post_saves`

- Purpose: application state for post saves
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`, `post_id -> posts.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `post_saves_actor_id_post_id_key`, `post_saves_pkey`
- Unique constraints: `post_saves_actor_id_post_id_key(actor_id,post_id)`
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `GET /v1/creator/insights`, `GET /v1/feed/home`, `GET /v1/feed/profile/:profileId`, `GET /v1/me/collections/:collectionId/items`, `POST /v1/me/collections/:collectionId/items`, `GET /v1/media/:mediaFile`, `GET /v1/posts/:postId`, `DELETE /v1/posts/:postId/like`, `POST /v1/posts/:postId/like`, `DELETE /v1/posts/:postId/repost`, `POST /v1/posts/:postId/repost`, `DELETE /v1/posts/:postId/save`, `POST /v1/posts/:postId/save`, `GET /v1/profiles/:handle/posts`, `GET /v1/saves`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/collections/service.ts`, `services/greenfield-api/src/domains/posts/repository.ts`, `services/greenfield-api/src/domains/saves/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`
- API/worker source writes: `services/greenfield-api/src/domains/saves/service.ts`
- Disposition: active read/write or ledger/schema table

### `posts`

- Purpose: application state for posts
- Primary key: `id`
- Foreign keys: `author_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `author_actor_id`
- Indexes: `posts_author_actor_id_idempotency_key_key`, `posts_pkey`, `posts_search_vector_idx`
- Unique constraints: `posts_author_actor_id_idempotency_key_key(author_actor_id,idempotency_key)`
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/admin/ops/policy/evaluate`, `GET /v1/attachments/:attachmentId/content`, `POST /v1/auth/preview/session`, `DELETE /v1/comments/:commentId/pin`, `PUT /v1/comments/:commentId/pin`, `POST /v1/comments/:commentId/replies`, `POST /v1/communities/:communityId/posts`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `GET /v1/creator/insights`, `GET /v1/discover`, `GET /v1/feed/home`, `GET /v1/feed/profile/:profileId`, `GET /v1/hashtags/suggest`, `GET /v1/media/:mediaFile`, `POST /v1/posts`, `DELETE /v1/posts/:postId`, `GET /v1/posts/:postId`, `PATCH /v1/posts/:postId`, `POST /v1/posts/:postId/comments`, `DELETE /v1/posts/:postId/like`, `POST /v1/posts/:postId/like`, `POST /v1/posts/:postId/quote`, `DELETE /v1/posts/:postId/reaction`, `PUT /v1/posts/:postId/reaction`, `GET /v1/posts/:postId/reactions`, `DELETE /v1/posts/:postId/repost`, `POST /v1/posts/:postId/repost`, `DELETE /v1/posts/:postId/save`, `POST /v1/posts/:postId/save`, `POST /v1/posts/:postId/share`, `GET /v1/profiles/:handle`, `GET /v1/profiles/:handle/followers`, `GET /v1/profiles/:handle/following`, `GET /v1/profiles/:handle/posts`, `DELETE /v1/profiles/:profileId/follow`, `POST /v1/profiles/:profileId/follow`, `PATCH /v1/profiles/me`, `GET /v1/reels`, `POST /v1/reports`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/admin/moderation/reports/:reportId/actions`, `DELETE /v1/comments/:commentId`, `POST /v1/comments/:commentId/replies`, `POST /v1/posts`, `DELETE /v1/posts/:postId`, `PATCH /v1/posts/:postId`, `POST /v1/posts/:postId/comments`, `DELETE /v1/posts/:postId/like`, `POST /v1/posts/:postId/like`, `POST /v1/posts/:postId/quote`, `DELETE /v1/posts/:postId/reaction`, `PUT /v1/posts/:postId/reaction`, `DELETE /v1/posts/:postId/repost`, `POST /v1/posts/:postId/repost`, `DELETE /v1/posts/:postId/save`, `POST /v1/posts/:postId/save`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/app/register-composer-routes.ts`, `services/greenfield-api/src/app/register-routes.ts`, `services/greenfield-api/src/domains/comments/service.ts`, `services/greenfield-api/src/domains/communities/service.ts`, `services/greenfield-api/src/domains/discovery/repository.ts`, `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/domains/posts/repository.ts`, `services/greenfield-api/src/domains/posts/writes.ts`, `services/greenfield-api/src/domains/profiles/repository.ts`, `services/greenfield-api/src/domains/quotes/service.ts`, `services/greenfield-api/src/domains/reactions/service.ts`, `services/greenfield-api/src/domains/saves/service.ts`, `services/greenfield-api/src/domains/shares/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`, `services/greenfield-worker/src/digests/digests.ts`, `services/greenfield-worker/src/search/index.ts`, `services/greenfield-worker/src/search/post-projector.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/domains/comments/service.ts`, `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/posts/writes.ts`, `services/greenfield-api/src/domains/quotes/service.ts`, `services/greenfield-api/src/domains/reactions/service.ts`
- Disposition: active read/write or ledger/schema table

### `profile_links`

- Purpose: application state for profile links
- Primary key: `id`
- Foreign keys: `profile_id -> profiles.id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `profile_links_pkey`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `POST /v1/auth/preview/session`, `GET /v1/profiles/:handle`, `GET /v1/profiles/:handle/followers`, `GET /v1/profiles/:handle/following`, `DELETE /v1/profiles/:profileId/follow`, `POST /v1/profiles/:profileId/follow`, `PATCH /v1/profiles/me`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/profiles/repository.ts`, `services/greenfield-worker/src/search/profile-projector.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `profile_media`

- Purpose: application state for profile media
- Primary key: `profile_id`, `kind`
- Foreign keys: `attachment_id -> attachments.attachment_id`, `profile_id -> profiles.id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `profile_media_attachment_id_key`, `profile_media_attachment_idx`, `profile_media_pkey`
- Unique constraints: `profile_media_attachment_id_key(attachment_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `058_post05_profile_media.sql`
- Routes reading: `GET /v1/attachments/:attachmentId/content`, `DELETE /v1/profiles/me/avatar`, `POST /v1/profiles/me/avatar`, `DELETE /v1/profiles/me/cover`, `POST /v1/profiles/me/cover`
- Routes writing: `DELETE /v1/profiles/me/avatar`, `POST /v1/profiles/me/avatar`, `DELETE /v1/profiles/me/cover`, `POST /v1/profiles/me/cover`
- API/worker source reads: `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/domains/comments/media.ts`, `services/greenfield-api/src/domains/profiles/writes.ts`
- API/worker source writes: `services/greenfield-api/src/domains/profiles/writes.ts`
- Disposition: active read/write or ledger/schema table

### `profiles`

- Purpose: application state for profiles
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `profiles_actor_id_key`, `profiles_handle_canonical_uidx`, `profiles_pkey`, `profiles_search_vector_idx`
- Unique constraints: `profiles_actor_id_key(actor_id)`
- Soft delete: deleted_at
- Timestamps: `focus_status_updated_at`, `joined_at`, `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `POST /v1/account/data-requests/:requestId/advance`, `GET /v1/accounts/me/blocks`, `GET /v1/accounts/me/mutes`, `POST /v1/admin/ops/policy/evaluate`, `GET /v1/attachments/:attachmentId/content`, `POST /v1/auth/preview/session`, `GET /v1/calls/:callId`, `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `GET /v1/calls/:callId/signalling`, `DELETE /v1/comments/:commentId/pin`, `PUT /v1/comments/:commentId/pin`, `PUT /v1/comments/:commentId/poll/vote`, `GET /v1/comments/:commentId/replies`, `POST /v1/comments/:commentId/replies`, `DELETE /v1/connections/:connectionId`, `POST /v1/connections/:connectionId/refresh`, `GET /v1/conversations`, `POST /v1/conversations`, `POST /v1/conversations/:id/calls`, `GET /v1/conversations/:id/messages`, `POST /v1/conversations/:id/messages`, `PATCH /v1/conversations/:id/messages/:messageId`, `DELETE /v1/conversations/:id/messages/:messageId/reactions`, `GET /v1/conversations/:id/messages/:messageId/reactions`, `PUT /v1/conversations/:id/messages/:messageId/reactions`, `GET /v1/conversations/:id/messages/:messageId/receipts`, `GET /v1/conversations/:id/typing`, `GET /v1/feed/profile/:profileId`, `POST /v1/follow-requests/:requestId/accept`, `POST /v1/groups`, `GET /v1/groups/:id`, `PATCH /v1/groups/:id`, `POST /v1/groups/:id/members`, `DELETE /v1/groups/:id/members/:actorId`, `POST /v1/groups/:id/members/:actorId/role`, `GET /v1/in-mail`, `POST /v1/in-mail`, `GET /v1/in-mail/:id`, `POST /v1/in-mail/:id/replies`, `GET /v1/me/calls`, `GET /v1/message-requests`, `POST /v1/message-requests/:id/accept`, `GET /v1/messages/search`, `GET /v1/posts/:postId/comments`, `POST /v1/posts/:postId/comments`, `GET /v1/profiles/:handle`, `GET /v1/profiles/:handle/followers`, `GET /v1/profiles/:handle/following`, `GET /v1/profiles/:handle/posts`, `DELETE /v1/profiles/:profileId/block`, `POST /v1/profiles/:profileId/block`, `DELETE /v1/profiles/:profileId/follow`, `POST /v1/profiles/:profileId/follow`, `DELETE /v1/profiles/:profileId/mute`, `POST /v1/profiles/:profileId/mute`, `PATCH /v1/profiles/me`, `DELETE /v1/profiles/me/avatar`, `POST /v1/profiles/me/avatar`, `DELETE /v1/profiles/me/cover`, `POST /v1/profiles/me/cover`, `GET /v1/profiles/me/follow-requests`, `POST /v1/reports`, `POST /v1/stories`, `GET /v1/stories/:groupId`, `GET /v1/stories/rail`
- Routes writing: `POST /v1/account/data-requests/:requestId/advance`, `POST /v1/accounts/me/handle`, `POST /v1/accounts/verify-email`, `PATCH /v1/profiles/me`, `DELETE /v1/profiles/me/avatar`, `POST /v1/profiles/me/avatar`, `DELETE /v1/profiles/me/cover`, `POST /v1/profiles/me/cover`
- API/worker source reads: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/app/register-attachment-routes.ts`, `services/greenfield-api/src/app/register-routes.ts`, `services/greenfield-api/src/domains/calls/service.ts`, `services/greenfield-api/src/domains/comments/service.ts`, `services/greenfield-api/src/domains/messaging/service.ts`, `services/greenfield-api/src/domains/moderation/repository.ts`, `services/greenfield-api/src/domains/policy/engine.ts`, `services/greenfield-api/src/domains/posts/repository.ts`, `services/greenfield-api/src/domains/profiles/repository.ts`, `services/greenfield-api/src/domains/profiles/writes.ts`, `services/greenfield-api/src/domains/stories/service.ts`, `services/greenfield-api/src/settings-v2/service.ts`, `services/greenfield-worker/src/digests/digests.ts`, `services/greenfield-worker/src/push/dispatch.ts`, `services/greenfield-worker/src/push/voip.ts`, `services/greenfield-worker/src/search/index.ts`, `services/greenfield-worker/src/search/post-projector.ts`, `services/greenfield-worker/src/search/profile-projector.ts`
- API/worker source writes: `services/greenfield-api/src/account-data/service.ts`, `services/greenfield-api/src/accounts/service.ts`, `services/greenfield-api/src/cli/api-atlas-identities.ts`, `services/greenfield-api/src/domains/profiles/writes.ts`
- Disposition: active read/write or ledger/schema table

### `push_deliveries`

- Purpose: application state for push deliveries
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `080_push_notifications.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-worker/src/push/dispatch.ts`
- API/worker source writes: `services/greenfield-api/src/domains/push/service.ts`, `services/greenfield-worker/src/push/dispatch.ts`
- Disposition: active read/write or ledger/schema table

### `push_device_tokens`

- Purpose: application state for push device tokens
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `080_push_notifications.sql`
- Routes reading: `POST /v1/calls/:callId/accept`, `POST /v1/calls/:callId/cancel`, `POST /v1/calls/:callId/decline`, `POST /v1/calls/:callId/end`, `GET /v1/calls/:callId/signalling`, `POST /v1/calls/:callId/signalling-ticket`, `POST /v1/conversations/:id/calls`, `GET /v1/push/devices`, `POST /v1/push/voip-devices`
- Routes writing: `POST /v1/push/devices`, `DELETE /v1/push/devices/:token`
- API/worker source reads: `services/greenfield-api/src/domains/calls/service.ts`, `services/greenfield-api/src/domains/push/service.ts`, `services/greenfield-worker/src/push/dispatch.ts`
- API/worker source writes: `services/greenfield-api/src/domains/push/service.ts`, `services/greenfield-worker/src/push/dispatch.ts`
- Disposition: active read/write or ledger/schema table

### `push_notification_preferences`

- Purpose: application state for push notification preferences
- Primary key: none observed
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: none observed
- Unique constraints: none observed
- Soft delete: none
- Timestamps: none observed
- Migration introduced: `080_push_notifications.sql`
- Routes reading: `GET /v1/push/preferences`, `PATCH /v1/push/preferences`
- Routes writing: `POST /v1/push/devices`, `GET /v1/push/preferences`, `PATCH /v1/push/preferences`
- API/worker source reads: `services/greenfield-api/src/domains/push/service.ts`, `services/greenfield-worker/src/push/dispatch.ts`
- API/worker source writes: `services/greenfield-api/src/domains/push/service.ts`
- Disposition: active read/write or ledger/schema table

### `recent_searches`

- Purpose: application state for recent searches
- Primary key: `recent_search_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `recent_searches_account_idx`, `recent_searches_account_query_unique`, `recent_searches_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `searched_at`, `created_at`
- Migration introduced: `021_phase7e_unified_search.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/search/repository.ts`
- API/worker source writes: `services/greenfield-api/src/domains/search/repository.ts`
- Disposition: active read/write or ledger/schema table

### `reels`

- Purpose: application state for reels
- Primary key: `id`
- Foreign keys: `author_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `author_actor_id`
- Indexes: `reels_pkey`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: none observed
- API/worker source writes: none observed
- Disposition: ORPHAN CANDIDATE — no static API/worker reference

### `reports`

- Purpose: application state for reports
- Primary key: `id`
- Foreign keys: `reporter_actor_id -> actors.id`, `reviewed_by_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `reporter_actor_id`, `reviewed_by_actor_id`
- Indexes: `reports_pkey`, `reports_reporter_idx`, `reports_review_queue_idx`, `reports_status_idx`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`, `reviewed_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: `GET /v1/admin/moderation/reports`, `GET /v1/admin/moderation/reports/:reportId`, `PATCH /v1/admin/moderation/reports/:reportId`, `POST /v1/admin/moderation/reports/:reportId/actions`, `POST /v1/reports`, `GET /v1/reports/me`
- Routes writing: `PATCH /v1/admin/moderation/reports/:reportId`, `POST /v1/admin/moderation/reports/:reportId/actions`, `POST /v1/reports`
- API/worker source reads: `services/greenfield-api/src/domains/moderation/repository.ts`
- API/worker source writes: `services/greenfield-api/src/domains/moderation/repository.ts`
- Disposition: active read/write or ledger/schema table

### `saved_searches`

- Purpose: application state for saved searches
- Primary key: `saved_search_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`
- Ownership/workspace/user/module columns: `account_id`
- Indexes: `saved_searches_account_idx`, `saved_searches_account_name_unique`, `saved_searches_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`, `updated_at`
- Migration introduced: `021_phase7e_unified_search.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/search/repository.ts`
- API/worker source writes: `services/greenfield-api/src/domains/search/repository.ts`
- Disposition: active read/write or ledger/schema table

### `schema_metadata`

- Purpose: application state for schema metadata
- Primary key: `key`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `schema_metadata_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `updated_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/system/health.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE

### `schema_migrations`

- Purpose: application state for schema migrations
- Primary key: `id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `schema_migrations_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `applied_at`
- Migration introduced: `not found by CREATE TABLE scan`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/database/migrate.ts`
- API/worker source writes: `services/greenfield-api/src/database/migrate.ts`
- Disposition: active read/write or ledger/schema table

### `search_documents`

- Purpose: application state for search documents
- Primary key: `document_id`
- Foreign keys: none
- Ownership/workspace/user/module columns: `account_id`, `owner_id`
- Indexes: `search_documents_account_id_idx`, `search_documents_entity_identity_idx`, `search_documents_entity_type_entity_id_key`, `search_documents_entity_type_idx`, `search_documents_owner_id_idx`, `search_documents_pkey`, `search_documents_status_idx`, `search_documents_tags_idx`, `search_documents_updated_at_idx`, `search_documents_vector_idx`, `search_documents_visibility_idx`
- Unique constraints: `search_documents_entity_type_entity_id_key(entity_type,entity_id)`
- Soft delete: none
- Timestamps: `created_at`, `updated_at`, `indexed_at`
- Migration introduced: `021_phase7e_unified_search.sql`
- Routes reading: `GET /v1/modules/:moduleId/health`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/search/repository.ts`, `services/greenfield-api/src/modules/health-service.ts`, `services/greenfield-worker/src/search/index.ts`, `services/greenfield-worker/src/search/projector.ts`
- API/worker source writes: `services/greenfield-api/src/domains/search/repository.ts`, `services/greenfield-worker/src/search/projector.ts`
- Disposition: active read/write or ledger/schema table

### `search_projection_failures`

- Purpose: application state for search projection failures
- Primary key: `failure_id`
- Foreign keys: `event_id -> greenfield_domain_events.event_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `search_projection_failures_entity_idx`, `search_projection_failures_pkey`, `search_projection_failures_projector_id_event_id_key`, `search_projection_failures_unresolved_idx`
- Unique constraints: `search_projection_failures_projector_id_event_id_key(projector_id,event_id)`
- Soft delete: none
- Timestamps: `first_failed_at`, `last_failed_at`, `resolved_at`
- Migration introduced: `021_phase7e_unified_search.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/search/repository.ts`
- API/worker source writes: `services/greenfield-api/src/domains/search/repository.ts`, `services/greenfield-worker/src/search/projector.ts`
- Disposition: active read/write or ledger/schema table

### `search_projection_state`

- Purpose: application state for search projection state
- Primary key: `projector_id`
- Foreign keys: `last_event_id -> greenfield_domain_events.event_id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `search_projection_state_entity_idx`, `search_projection_state_lag_idx`, `search_projection_state_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `last_processed_at`, `last_success_at`, `last_failure_at`
- Migration introduced: `021_phase7e_unified_search.sql`
- Routes reading: `GET /v1/modules/:moduleId/health`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/search/repository.ts`, `services/greenfield-api/src/modules/health-service.ts`
- API/worker source writes: `services/greenfield-worker/src/search/projector.ts`
- Disposition: active read/write or ledger/schema table

### `search_query_metrics`

- Purpose: application state for search query metrics
- Primary key: `request_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `actor_id -> actors.id`
- Ownership/workspace/user/module columns: `account_id`, `actor_id`
- Indexes: `search_query_metrics_created_idx`, `search_query_metrics_pkey`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `created_at`
- Migration introduced: `021_phase7e_unified_search.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/search/repository.ts`
- API/worker source writes: `services/greenfield-api/src/domains/search/repository.ts`
- Disposition: active read/write or ledger/schema table

### `search_reindex_requests`

- Purpose: application state for search reindex requests
- Primary key: `reindex_id`
- Foreign keys: `account_id -> greenfield_accounts.account_id`, `requested_by_actor_id -> actors.id`
- Ownership/workspace/user/module columns: `account_id`, `requested_by_actor_id`
- Indexes: `search_reindex_requests_account_idx`, `search_reindex_requests_pkey`, `search_reindex_requests_state_idx`
- Unique constraints: none observed
- Soft delete: none
- Timestamps: `cancellation_requested_at`, `created_at`, `updated_at`, `completed_at`
- Migration introduced: `021_phase7e_unified_search.sql`
- Routes reading: none observed
- Routes writing: none observed
- API/worker source reads: `services/greenfield-worker/src/search/index.ts`
- API/worker source writes: `services/greenfield-api/src/domains/search/repository.ts`, `services/greenfield-worker/src/search/index.ts`
- Disposition: active read/write or ledger/schema table

### `session_capabilities`

- Purpose: application state for session capabilities
- Primary key: `id`
- Foreign keys: `session_id -> sessions.id`
- Ownership/workspace/user/module columns: none observed
- Indexes: `session_capabilities_pkey`, `session_capabilities_session_id_capability_key`, `session_capabilities_session_idx`
- Unique constraints: `session_capabilities_session_id_capability_key(session_id,capability)`
- Soft delete: none
- Timestamps: `granted_at`, `revoked_at`, `created_at`, `updated_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/auth/preview/session`
- API/worker source reads: `services/greenfield-api/src/security/session.ts`
- API/worker source writes: `services/greenfield-api/src/security/session.ts`
- Disposition: active read/write or ledger/schema table

### `sessions`

- Purpose: application state for sessions
- Primary key: `id`
- Foreign keys: `actor_id -> actors.id`
- Ownership/workspace/user/module columns: `actor_id`
- Indexes: `sessions_actor_id_idx`, `sessions_expires_at_idx`, `sessions_pkey`, `sessions_token_hash_key`
- Unique constraints: `sessions_token_hash_key(token_hash)`
- Soft delete: none
- Timestamps: `created_at`, `expires_at`, `last_seen_at`, `revoked_at`, `updated_at`
- Migration introduced: `002_phase6_social_atproto.sql`
- Routes reading: none observed
- Routes writing: `POST /v1/auth/preview/session`, `DELETE /v1/sessions/me`
- API/worker source reads: `services/greenfield-api/src/security/session.ts`
- API/worker source writes: `services/greenfield-api/src/security/session.ts`
- Disposition: active read/write or ledger/schema table

### `trending_topics`

- Purpose: application state for trending topics
- Primary key: `id`
- Foreign keys: none
- Ownership/workspace/user/module columns: none observed
- Indexes: `trending_topics_pkey`
- Unique constraints: none observed
- Soft delete: deleted_at
- Timestamps: `created_at`, `updated_at`, `deleted_at`
- Migration introduced: `001_init_schema.sql`
- Routes reading: `GET /v1/discover`
- Routes writing: none observed
- API/worker source reads: `services/greenfield-api/src/domains/discovery/repository.ts`
- API/worker source writes: none observed
- Disposition: READ-ONLY APPLICATION CANDIDATE


## Orphan candidates

- `greenfield_backup_acl_reconciliation`
- `greenfield_backup_sequence_acl_reconciliation`
- `greenfield_checkpoints`
- `greenfield_connection_sync_state`
- `greenfield_connector_providers`
- `greenfield_event_schema_registry`
- `greenfield_extension_entity_metadata`
- `greenfield_module_sync_sources`
- `greenfield_notification_batches`
- `greenfield_schema_versions`
- `intelligence_circuit_revisions`
- `intelligence_circuits`
- `module_backend_event_subscriptions`
- `reels`
