import type {Generated} from 'kysely'

export type ActorKind = 'person' | 'team' | 'organisation' | 'service'
export type ProfileKind = 'person' | 'creator' | 'professional' | 'organisation' | 'team'
export type ProfileVisibility = 'public' | 'followers' | 'teams' | 'private'
export type PostKind = 'text' | 'media' | 'link' | 'module'
export type FeedMode = 'following' | 'forYou' | 'modules'
export type Audience = 'public' | 'followers' | 'private'
export type ReplyPermission = 'everyone' | 'followers' | 'mentioned' | 'none'
export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'document' | 'unknown'
export type AttachmentStatus = 'created' | 'uploading' | 'uploaded' | 'processing' | 'ready' | 'failed' | 'expired' | 'rejected'

export type SessionStatus = 'active' | 'expired' | 'revoked' | 'suspended'
export type AuthenticationMethodType = 'passkey' | 'password' | 'email_otp' | 'totp' | 'recovery_code' | 'apple' | 'oidc'
export type AuthenticationMethodState = 'pending' | 'active' | 'disabled' | 'revoked'
export type AuthenticationStrength = 'low' | 'medium' | 'strong' | 'phishing_resistant' | 'recovery'
export type AuthenticationChallengePurpose =
  | 'email_verification'
  | 'email_login'
  | 'password_reset'
  | 'email_change'
  | 'contact_email_change'
  | 'passkey_registration'
  | 'passkey_authentication'
  | 'totp_enrollment'
  | 'step_up'
  | 'account_recovery'
  | 'apple_authentication'
  | 'apple_linking'
export type AuthenticationChallengeState = 'pending' | 'verified' | 'consumed' | 'expired' | 'superseded' | 'locked'
export type AuthenticationChallengeResult = 'succeeded' | 'failed' | 'expired' | 'replayed' | 'rate_limited' | 'locked'
export type AuthenticationDeliveryChannel = 'email' | 'authenticator' | 'webauthn' | 'recovery' | 'internal' | 'external'
export type SecurityEventSeverity = 'info' | 'notice' | 'warning' | 'critical'
export type NotificationType = 'follow' | 'like' | 'repost' | 'reply' | 'mention' | 'module_event'
export type FollowRequestStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED'
export type ReportTargetType = 'profile' | 'post' | 'comment' | 'story' | 'message' | 'other'
export type ReportCategory = 'spam' | 'harassment' | 'impersonation' | 'illegal-content' | 'privacy' | 'other'
export type ReportStatus = 'open' | 'reviewing' | 'resolved' | 'dismissed'
export type DeveloperProgrammeState = 'NOT_ENROLLED' | 'PENDING' | 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'TERMINATED'
export type DeveloperProductKind = 'module' | 'addon' | 'plugin' | 'function' | 'tool' | 'widget' | 'connector' | 'backend-service' | 'backend-engine' | 'game-module' | 'service' | 'engine' | 'game' | 'integration' | 'theme'
export type DeveloperProductVisibility = 'PRIVATE' | 'INTERNAL' | 'UNLISTED' | 'BETA' | 'PUBLIC'
export type DeveloperReleaseChannel = 'DEVELOPMENT' | 'INTERNAL' | 'ALPHA' | 'BETA' | 'RC' | 'STABLE'
export type DeveloperReviewState = 'DRAFT' | 'SUBMITTED' | 'AUTOMATED_REVIEW' | 'MANUAL_REVIEW' | 'CHANGES_REQUIRED' | 'APPROVED' | 'REJECTED' | 'PUBLISHED' | 'SUSPENDED' | 'REMOVED'
export type BackgroundJobStatus = 'QUEUED' | 'LEASED' | 'RUNNING' | 'RETRYING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'DEAD_LETTER'
export type BackgroundJobOwnerType = 'platform' | 'account' | 'organisation' | 'product' | 'installation'
export type BackgroundJobDispatchMode = 'GREENFIELD_WORKER' | 'SERVICE_PULL'
export type EventProducerKind = 'platform' | 'product' | 'service' | 'connector' | 'user'
export type GreenfieldEngineExecutionMode = 'IN_PROCESS' | 'SERVICE_FABRIC' | 'CONTRACT_ONLY'
export type GreenfieldEngineRuntimeStatus = 'READY' | 'CONTRACT_ONLY' | 'DISABLED' | 'QUARANTINED'
export type GreenfieldEngineCapabilityAvailability = 'READY' | 'PROVIDER_REQUIRED' | 'CONTRACT_ONLY'
export type MailJobStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'retrying' | 'dead-letter'
export type MailFailureCategory = 'temporary' | 'permanent' | 'authentication' | 'rate-limit' | 'DNS' | 'TLS' | 'invalid-recipient'
export type MailIdentityState = 'pending' | 'queued' | 'provisioning' | 'active' | 'suspended' | 'released' | 'failed' | 'adoption_required'
export type MailIdentityRequestType = 'provision' | 'adopt' | 'suspend' | 'resume' | 'forward' | 'release'
export type MailIdentityRequestState = 'queued' | 'leased' | 'completed' | 'failed' | 'cancelled'
export type MailboxCredentialKind = 'imap_smtp_password'
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
export type GreenfieldSearchEntityType = 'post' | 'profile' | 'module' | 'module-release' | 'note' | 'vault-folder' | 'module-record'
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
  | 'record.restore'
  | 'record.purge'
  | 'record.query'
  | 'function.invoke'
  | 'settings.update'
  | 'share'
  | 'dismiss'
export type GreenfieldModuleActionEventKind =
  | GreenfieldModuleActionKind
  | 'record.read'
  | 'service.invoke'
  | 'extension.invoke'
  | 'capability.invoke'
export type GreenfieldModuleRuntimeRegistrationStatus = 'declared' | 'registered' | 'disabled' | 'quarantined' | 'revoked'
export type GreenfieldModuleRuntimeVisibility = 'private' | 'teams' | 'followers' | 'public' | 'system'
export type GreenfieldModuleRetentionPolicy = 'keepOnUninstall' | 'deleteOnUninstall' | 'exportRequired'
export type GreenfieldModuleDataRetentionChoice = 'keepData' | 'exportThenDelete' | 'deleteData'
export type GreenfieldModuleDependencyRelation = 'requires' | 'optional' | 'recommended' | 'conflicts' | 'replaces' | 'provides'
export type GreenfieldModulePermissionState = 'requested' | 'granted' | 'denied' | 'revoked' | 'unsupported' | 'requires-platform' | 'requires-reauthorisation'
export type GreenfieldModuleCapabilityProviderKind = 'host' | 'module' | 'connector' | 'ai-provider' | 'storage' | 'service' | 'api'
export type GreenfieldModuleCapabilityHealthState = 'healthy' | 'degraded' | 'unavailable' | 'configuration-required' | 'disabled' | 'quarantined'
export type GreenfieldModuleRegistrationStatus2 = 'registered' | 'disabled' | 'quarantined' | 'removed'
export type GreenfieldModuleLifecycleTransactionAction = 'install' | 'enable' | 'disable' | 'update' | 'uninstall' | 'repair' | 'quarantine' | 'unquarantine'
export type GreenfieldModuleLifecycleTransactionStatus = 'planned' | 'running' | 'completed' | 'failed' | 'rolled-back' | 'cancelled'
export type GreenfieldModuleLifecycleStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped' | 'rolled-back'
export type GreenfieldModuleRuntimeStorageKind = 'records' | 'settings' | 'cache' | 'temporary' | 'object-storage' | 'attachments' | 'secrets' | 'history'
export type GreenfieldModuleStorageAllocationStatus = 'allocated' | 'disabled' | 'quarantined' | 'released'
export type GreenfieldDataStorageMode = 'greenfield-records' | 'dedicated-postgres' | 'object-storage' | 'external-service'
export type GreenfieldDataEncryptionClassification = 'public' | 'internal' | 'private' | 'sensitive' | 'restricted'
export type GreenfieldDataResourceState = 'ACTIVE' | 'DISABLED' | 'QUARANTINED' | 'EXPORT_PENDING' | 'DELETE_PENDING' | 'RETAINED' | 'DELETED'
export type GreenfieldDataStorageBindingState = 'PROVISIONING' | 'ACTIVE' | 'DEGRADED' | 'RETIRED'
export type GreenfieldDataSchemaCompatibility = 'BACKWARD' | 'FORWARD' | 'FULL' | 'BREAKING' | 'UNSPECIFIED'
export type GreenfieldDataSchemaState = 'DECLARED' | 'ACTIVE' | 'SUPERSEDED' | 'REVOKED'
export type GreenfieldDataMigrationState = 'PLANNED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'ROLLED_BACK'
export type GreenfieldDataRetentionMode = 'RETAIN' | 'DELETE_ON_UNINSTALL' | 'ARCHIVE_ON_UNINSTALL' | 'TTL' | 'LEGAL_HOLD'
export type GreenfieldDataBackupResponsibility = 'GREENFIELD' | 'PRODUCT_SERVICE' | 'EXTERNAL_PROVIDER' | 'NOT_APPLICABLE'
export type GreenfieldDataBackupMode = 'MANAGED' | 'DECLARED' | 'EXTERNAL' | 'NONE'
export type GreenfieldModuleSecretStatus = 'active' | 'rotated' | 'revoked' | 'deleted'
export type GreenfieldModuleJobRegistrationStatus = 'registered' | 'paused' | 'disabled' | 'quarantined' | 'removed'
export type GreenfieldModuleUiContributionSurface = 'board' | 'profile-tabs' | 'settings' | 'composer-tools' | 'context-menu' | 'search-provider' | 'module-route' | 'widget'
export type GreenfieldModuleServiceInvocationStatus = 'accepted' | 'completed' | 'failed' | 'denied' | 'timed-out'
export type GreenfieldExtensionProductKind = 'module' | 'addon' | 'plugin' | 'function' | 'tool' | 'widget' | 'connector' | 'service' | 'engine' | 'game' | 'integration' | 'theme'
export type GreenfieldExtensionContributionKind = 'view.section' | 'toolbar.action' | 'editor.command' | 'editor.attachment' | 'menu.item' | 'contextMenu.item' | 'settings.section' | 'home.section' | 'widget' | 'record.decorator' | 'search.provider' | 'composer.tool' | 'background.action'
export type GreenfieldExtensionRuntimeState = 'NOT_INSTALLED' | 'RESOLVING' | 'INSTALLING' | 'INSTALLED' | 'ENABLING' | 'ENABLED' | 'DISABLING' | 'DISABLED' | 'UNINSTALLING' | 'UPDATE_AVAILABLE' | 'UPDATING' | 'INCOMPATIBLE' | 'QUARANTINED' | 'FAILED'
export type GreenfieldExtensionContributionStatus = 'registered' | 'enabled' | 'disabled' | 'incompatible' | 'failed' | 'quarantined' | 'removed'
export type GreenfieldExtensionGrantState = 'requested' | 'granted' | 'denied' | 'revoked' | 'requires-reauthorisation'
export type GreenfieldExtensionJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'RETRYING' | 'CANCELLED'
export type ModuleBackendMode = 'greenfield-managed' | 'module-managed' | 'hybrid' | 'frontend-only'
export type ModuleBackendLifecycleState = 'unconfigured' | 'discovering' | 'verifying' | 'available' | 'degraded' | 'unreachable' | 'incompatible' | 'revoked' | 'quarantined' | 'disabled'
export type ModuleBackendVerificationStatus = 'not-required' | 'pending' | 'verified' | 'failed' | 'quarantined'
export type ModuleBackendHealthComponent = 'discovery' | 'identity' | 'tls' | 'protocol' | 'authentication' | 'api' | 'database' | 'queue' | 'events' | 'webhooks' | 'search' | 'storage' | 'gateway'
export type ModuleBackendHealthStatus = 'healthy' | 'degraded' | 'unreachable' | 'incompatible' | 'quarantined' | 'disabled'
export type ModuleBackendCircuitState = 'closed' | 'open' | 'half-open'
export type ModuleBackendCapabilityProvider = 'greenfield' | 'module-backend' | 'external-connector' | 'local'
export type ModuleBackendEventDirection = 'greenfield-to-backend' | 'backend-to-greenfield'
export type ModuleBackendDeliveryStatus = 'pending' | 'accepted' | 'duplicate' | 'rejected' | 'failed' | 'dead_lettered'
export type ModuleBackendWebhookDirection = 'incoming' | 'outgoing'
export type ModuleBackendFailureType = 'discovery' | 'identity' | 'tls' | 'protocol' | 'authentication' | 'gateway' | 'event' | 'webhook' | 'health' | 'network-policy' | 'schema' | 'circuit-breaker'
export type GreenfieldAIProviderKind = 'openai' | 'anthropic' | 'google' | 'ollama' | 'lm-studio' | 'azure-openai' | 'local' | 'future'
export type GreenfieldAIProviderStatus = 'available' | 'unconfigured' | 'disabled' | 'degraded' | 'retired'
export type GreenfieldAIProviderConfigurationMode = 'disabled' | 'platform-managed' | 'customer-managed' | 'local' | 'development-mock' | 'server-managed' | 'account-managed' | 'local-runtime' | 'future'
export type GreenfieldAIModelAvailability = 'available' | 'unavailable' | 'coming-soon'
export type GreenfieldAIModelLifecycleStatus = 'active' | 'preview' | 'deprecated' | 'retired'
export type GreenfieldAIPromptLifecycleStatus = 'draft' | 'active' | 'deprecated' | 'retired'
export type GreenfieldAIRequestStatus = 'accepted' | 'running' | 'completed' | 'failed' | 'cancelled' | 'denied'
export type GreenfieldAIToolSideEffect = 'none' | 'internal-write' | 'external-write' | 'financial' | 'destructive'
export type GreenfieldAIToolConfirmation = 'none' | 'user' | 'reauthentication' | 'operator'
export type GreenfieldAIToolRunStatus = 'validated' | 'confirmation_required' | 'completed' | 'failed' | 'denied'
export type GreenfieldAIToolConfirmationStatus = 'not-required' | 'required' | 'confirmed' | 'denied'
export type GreenfieldAIStreamStatus = 'open' | 'reconnecting' | 'completed' | 'cancelled' | 'failed'
export type IntelligenceMissionStatus = 'draft' | 'planning' | 'awaiting_verification' | 'awaiting_authorization' | 'awaiting_approval' | 'running' | 'completed' | 'failed' | 'cancelled' | 'blocked'
export type IntelligenceApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled'
export type IntelligenceExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'blocked'
export type IntelligenceRisk = 'read_only' | 'write_reversible' | 'write_irreversible' | 'external_side_effect' | 'privileged' | 'financial' | 'unknown'
export type AIProviderCredentialScopeType = 'platform' | 'organisation' | 'account' | 'development'
export type AIProviderCredentialStatus = 'active' | 'unverified' | 'verification_failed' | 'rotated' | 'revoked'
export type AIExecutionStatus = 'accepted' | 'running' | 'completed' | 'failed' | 'cancelled' | 'denied'
export type AIExecutionAttemptStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type AIProviderHealthState = 'healthy' | 'degraded' | 'rate-limited' | 'authentication-failed' | 'unavailable' | 'disabled' | 'unknown'
export type AIProviderHealthComponent = 'configuration' | 'credentials' | 'network' | 'model-discovery' | 'execution' | 'streaming' | 'structured-output'
export type AICircuitState = 'closed' | 'open' | 'half-open'
export type AIUsageLimitScope = 'platform' | 'organisation' | 'account' | 'module' | 'installation' | 'provider' | 'model'
export type AIUsageLimitKind = 'requests-per-minute' | 'concurrent-executions' | 'daily-input-units' | 'daily-output-units' | 'estimated-spend' | 'single-request-size'
export type AIQuotaUnit = 'request' | 'execution' | 'input-token' | 'output-token' | 'context-byte' | 'minor-currency-unit'
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
  attachments: {
    attachment_id: string
    owner_account_id: string
    kind: AttachmentKind
    mime_type: string
    original_filename: string
    byte_size: string
    checksum: string | null
    storage_key: string | null
    storage_provider: string
    status: AttachmentStatus
    width: number | null
    height: number | null
    duration_seconds: number | null
    page_count: number | null
    thumbnail_key: string | null
    preview_key: string | null
    metadata: unknown
    attached_at: Date | null
    created_at: Date
    updated_at: Date
  }
  attachment_upload_sessions: {
    upload_id: string
    attachment_id: string
    owner_account_id: string
    expected_byte_size: string
    expected_mime_type: string
    expected_checksum: string | null
    state: 'created' | 'uploading' | 'completed' | 'failed' | 'expired'
    expires_at: Date
    completed_at: Date | null
    created_at: Date
    updated_at: Date
  }
  profile_media: {
    profile_id: string
    kind: 'avatar' | 'cover'
    attachment_id: string
    created_at: Date
    updated_at: Date
  }
  post_content: {
    content_id: string
    post_id: string
    content_type: 'image' | 'video' | 'audio' | 'pdf' | 'document'
    attachment_id: string
    sort_order: number
    caption: string | null
    created_at: Date
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
  follow_requests: {
    request_id: string
    requester_actor_id: string
    target_actor_id: string
    status: FollowRequestStatus
    created_at: Date
    updated_at: Date
    resolved_at: Date | null
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
    producer_kind: EventProducerKind
    producer_id: string
    product_id: string | null
    installation_id: string | null
    release_id: string | null
    trace_id: string
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
    evidence_refs: unknown
    reviewed_by_actor_id: string | null
    reviewed_at: Date | null
    resolution: string | null
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
  greenfield_post_shares: {
    share_id: string
    actor_id: string
    post_id: string
    channel: 'copy-link' | 'native' | 'direct' | 'external'
    idempotency_key: string | null
    created_at: Date
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
    owner_type: Generated<BackgroundJobOwnerType>
    owner_id: Generated<string>
    owner_account_id: Generated<string | null>
    product_id: Generated<string | null>
    installation_id: Generated<string | null>
    release_id: Generated<string | null>
    action: string
    service_id: Generated<string>
    dispatch_mode: Generated<BackgroundJobDispatchMode>
    timeout_ms: Generated<number>
    idempotency_key: Generated<string | null>
    trace_id: string
    started_at: Generated<Date | null>
    finished_at: Generated<Date | null>
    result_reference: Generated<string | null>
    error_class: Generated<string | null>
    error_code: Generated<string | null>
  }
  greenfield_mail_jobs: {
    mail_job_id: string
    template_id: string
    recipient_account_id: string | null
    recipient_address: string
    recipient_hash: string
    recipient_domain: string
    recipient_safe: string
    locale: string
    variables: unknown
    subject: string
    text_body: string
    html_body: string
    status: MailJobStatus
    attempt_count: number
    maximum_attempts: number
    provider_message_id: string | null
    failure_category: MailFailureCategory | null
    failure_message: string | null
    correlation_id: string | null
    available_at: Date
    queued_at: Date
    sending_at: Date | null
    sent_at: Date | null
    failed_at: Date | null
    dead_lettered_at: Date | null
    created_at: Date
    updated_at: Date
  }
  job_failures: {
    id: string
    job_id: string
    job_type: string
    payload: unknown
    error_code: string
    error_message: string
    permanent: boolean
    payload_fingerprint: string
    error_class: string | null
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
  greenfield_worker_heartbeats: {worker_id: string; release_sha: string | null; started_at: Date; last_seen_at: Date}
  greenfield_support_cases: {case_id: string; reference: string; account_id: string; category: 'help' | 'bug' | 'account' | 'privacy' | 'safety' | 'feedback'; subject: string; message: string; diagnostics: unknown | null; state: 'OPEN' | 'ANSWERED' | 'CLOSED'; idempotency_key: string; mail_job_id: string | null; created_at: Date; updated_at: Date}
  greenfield_account_app_preferences: {account_id: string; preferences: unknown; version: number; updated_at: Date}
  greenfield_digest_deliveries: {account_id: string; digest_kind: 'weekly' | 'morning'; period_key: string; outcome: 'queued' | 'quiet' | 'no-email'; mail_job_id: string | null; summary: unknown; created_at: Date}
  greenfield_creator_ledger_entries: {entry_id: string; account_id: string; entry_kind: 'earning' | 'payout' | 'refund' | 'fee' | 'adjustment'; amount_minor: string | number; currency: string; description: string; source: string; source_reference: string | null; occurred_at: Date; created_at: Date}
  greenfield_commerce_invoices: {invoice_id: string; account_id: string; invoice_number: string; state: 'open' | 'paid' | 'void' | 'refunded'; description: string; total_minor: string | number; currency: string; provider: string; provider_reference: string | null; issued_at: Date; paid_at: Date | null; created_at: Date}
  greenfield_accounts: {account_id: string; primary_handle: string; status: 'pendingVerification' | 'active' | 'suspended' | 'deactivated' | 'deleted'; created_at: Date; updated_at: Date}
  greenfield_handles: {handle: string; account_id: string; status: 'active' | 'released' | 'reserved'; created_at: Date}
  greenfield_handle_history: {history_id: string; account_id: string; handle: string; action: string; created_at: Date}
  greenfield_reserved_handles: {handle: string; reason: string; created_at: Date}
  greenfield_reserved_identifiers: {identifier: string; registry_version: string; applies_to: string[]; reason: string; created_at: Date}
  greenfield_auth_identities: {identity_id: string; account_id: string; kind: 'email' | 'passkey' | 'oidc'; identifier: string; verified_at: Date | null; metadata: unknown; created_at: Date; updated_at: Date}
  greenfield_mail_identities: {mail_identity_id: string; account_id: string; contact_identity_id: string | null; local_part: string; domain: string; address: string; state: MailIdentityState; provider: string | null; provider_reference: string | null; forwarding_enabled: boolean; forwarding_destination: string | null; forwarding_destination_hash: string | null; keep_local_copy: boolean; quota_bytes: number | null; storage_used_bytes: number | null; retry_count: number; last_error_code: string | null; last_error_message: string | null; adopted_at: Date | null; provisioned_at: Date | null; activated_at: Date | null; suspended_at: Date | null; resumed_at: Date | null; released_at: Date | null; failed_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_mail_identity_requests: {request_id: string; mail_identity_id: string; account_id: string; request_type: MailIdentityRequestType; state: MailIdentityRequestState; idempotency_key: string; provider: string; payload: unknown; requested_by_account_id: string | null; service_actor: string | null; operator_intent: boolean; attempt_count: number; maximum_attempts: number; last_error_code: string | null; last_error_message: string | null; created_at: Date; updated_at: Date; completed_at: Date | null; failed_at: Date | null}
  greenfield_mailbox_credentials: {credential_id: string; mail_identity_id: string; account_id: string; credential_kind: MailboxCredentialKind; secret_hash: string; encrypted_secret: Buffer | null; encryption_key_version: string | null; created_at: Date; rotated_at: Date | null; revoked_at: Date | null}
  greenfield_mail_identity_events: {event_id: string; mail_identity_id: string | null; account_id: string | null; event_type: string; actor_account_id: string | null; service_actor: string | null; metadata: unknown; created_at: Date}
  greenfield_password_credentials: {account_id: string; password_hash: string; params: unknown; updated_at: Date}
  greenfield_authentication_methods: {method_id: string; account_id: string; method_type: AuthenticationMethodType; display_label: string | null; state: AuthenticationMethodState; strength: AuthenticationStrength; verified_at: Date | null; last_used_at: Date | null; created_at: Date; updated_at: Date; revoked_at: Date | null; metadata: unknown}
  greenfield_auth_challenges: {challenge_id: string; purpose: AuthenticationChallengePurpose; account_id: string | null; method_id: string | null; subject_identifier: string | null; target_hash: string | null; challenge_hash: string; verifier_hash: string | null; verifier_hint: string | null; delivery_channel: AuthenticationDeliveryChannel | null; state: AuthenticationChallengeState; attempt_limit: number; attempt_count: number; rate_limit_key: string | null; expires_at: Date; verified_at: Date | null; consumed_at: Date | null; superseded_at: Date | null; last_attempt_at: Date | null; created_at: Date; metadata: unknown}
  greenfield_auth_challenge_attempts: {attempt_id: string; challenge_id: string | null; account_id: string | null; purpose: string; result: AuthenticationChallengeResult; failure_code: string | null; created_at: Date; metadata: unknown}
  greenfield_auth_rate_limits: {rate_limit_key: string; purpose: string; window_started_at: Date; attempt_count: number; blocked_until: Date | null; updated_at: Date}
  greenfield_passkeys: {passkey_id: string; account_id: string; credential_id: string; public_key: Buffer; counter: number; transports: unknown; created_at: Date; last_used_at: Date | null; method_id: string | null; algorithm: string | null; backup_eligible: boolean | null; backup_state: boolean | null; label: string | null; revoked_at: Date | null}
  greenfield_totp_credentials: {totp_id: string; method_id: string; account_id: string; secret_ciphertext: string; secret_key_id: string; algorithm: string; digits: number; period_seconds: number; state: AuthenticationMethodState; confirmed_at: Date | null; last_used_at: Date | null; created_at: Date; updated_at: Date; revoked_at: Date | null; metadata: unknown}
  greenfield_recovery_code_sets: {set_id: string; method_id: string; account_id: string; state: 'active' | 'invalidated' | 'exhausted' | 'revoked'; generated_at: Date; invalidated_at: Date | null; created_at: Date}
  greenfield_recovery_codes: {code_id: string; set_id: string; account_id: string; code_hash: string; used_at: Date | null; created_at: Date}
  greenfield_external_identities: {external_identity_id: string; method_id: string; account_id: string; provider: 'apple' | 'oidc'; provider_subject: string; provider_issuer: string | null; email: string | null; email_verified: boolean | null; linked_at: Date; last_used_at: Date | null; revoked_at: Date | null; metadata: unknown}
  greenfield_security_events: {event_id: string; account_id: string; session_id: string | null; event_type: string; method_type: AuthenticationMethodType | null; method_id: string | null; severity: SecurityEventSeverity; ip_hash: string | null; user_agent: string | null; metadata: unknown; created_at: Date}
  greenfield_email_verifications: {verification_id: string; account_id: string; token_hash: string; expires_at: Date; consumed_at: Date | null; created_at: Date}
  greenfield_recovery_tokens: {token_id: string; account_id: string; token_hash: string; expires_at: Date; consumed_at: Date | null; created_at: Date}
  greenfield_sessions: {session_id: string; account_id: string; status: 'active' | 'revoked' | 'expired'; family_id: string; created_at: Date; expires_at: Date; revoked_at: Date | null; last_seen_at: Date; user_agent: string | null; ip_hash: string | null; recent_authentication_at: Date | null; authentication_strength: AuthenticationStrength; authentication_method_id: string | null; client_name: string | null; platform: string | null}
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
  greenfield_extension_installations: {installation_id: string; extension_version_id: string; account_id: string; status: string; config: unknown; legacy_duplicate_allowed: Generated<boolean>; created_at: Date; updated_at: Date}
  greenfield_account_default_providers: {account_id: string; capability_role: string; provider_product_id: string; provider_installation_id: string; selected_by_account_id: string; selected_at: Date; updated_at: Date}
  greenfield_extension_capabilities: {capability_id: string; installation_id: string; capability: string; granted_at: Date; revoked_at: Date | null}
  greenfield_functions: {function_id: string; extension_version_id: string | null; name: string; kind: 'remoteHttp' | 'background' | 'native'; config: unknown; timeout_ms: number; created_at: Date}
  greenfield_tools: {tool_id: string; slug: string; display_name: string; availability: string; manifest: unknown; created_at: Date; updated_at: Date}
  greenfield_plugins: {plugin_id: string; extension_version_id: string | null; manifest: unknown; created_at: Date}
  greenfield_connectors: {connector_id: string; extension_version_id: string | null; manifest: unknown; created_at: Date}
  greenfield_widgets: {widget_id: string; extension_version_id: string | null; manifest: unknown; created_at: Date}
  greenfield_bridges: {bridge_id: string; slug: string; status: string; config: unknown; created_at: Date}
  greenfield_repository_exports: {export_id: string; repository_id: string; status: string; location: string | null; created_at: Date; expires_at: Date | null}
  greenfield_reactions: {reaction_id: string; actor_id: string; post_id: string; reaction_type: 'like' | 'love' | 'laugh' | 'fire' | 'celebrate' | 'insightful' | 'support' | 'curious'; created_at: Date; updated_at: Date}
  greenfield_link_previews: {url_hash: string; url: string; status: 'ok' | 'failed'; preview: unknown; fetched_at: Date}
  greenfield_comments: {comment_id: string; post_id: string; author_actor_id: string; parent_comment_id: string | null; root_comment_id: string | null; text: string; depth: number; reply_count: number; version: number; created_at: Date; updated_at: Date; deleted_at: Date | null; deletion_kind: 'user' | 'moderation' | null; media?: unknown; pinned_at?: Date | null; quoted_comment_id?: string | null}
  greenfield_comment_poll_votes: {comment_id: string; actor_id: string; option_index: number; created_at: Date}
  greenfield_link_blocklist: {domain: string; reason: string; created_at: Date}
  greenfield_comment_reactions: {reaction_id: string; actor_id: string; comment_id: string; reaction_type: 'like' | 'love' | 'laugh' | 'fire' | 'celebrate' | 'insightful' | 'support' | 'curious'; created_at: Date; updated_at: Date}
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
  greenfield_module_releases: {release_id: string; module_version_id: string; extension_id: string; extension_version_id: string; module_id: string; version: string; publisher_id: string; release_state: GreenfieldModuleReleaseState; source_repository: string; source_commit: string; manifest_path: string; manifest_sha256: string; release_sha256: string | null; signature_key_id: string | null; signature: string | null; compatibility: unknown; license_status: GreenfieldModuleLicenseStatus; trust_level: GreenfieldModuleTrustLevel; product_kind: GreenfieldExtensionProductKind; extension_product: unknown; published_at: Date | null; quarantined_at: Date | null; revoked_at: Date | null; superseded_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_module_ratings: {rating_id: string; module_id: string; account_id: string; rating: number; created_at: Date; updated_at: Date}
  greenfield_module_sources: {source_id: string; release_id: string; provider: 'github'; repository: string; repository_id: string | null; default_branch: string | null; commit: string; manifest_path: string; release_tag: string | null; release_asset_name: string | null; fetched_at: Date; etag: string | null}
  greenfield_module_dependencies: {dependency_id: string; release_id: string; module_id: string; dependency_module_id: string; version_range: string; optional: boolean; reason: string | null; created_at: Date}
  greenfield_module_permissions: {permission_id: string; release_id: string; permission: string; reason: string; risk: 'low' | 'medium' | 'high' | 'restricted'; requested_at: Date}
  greenfield_module_permission_reviews: {review_id: string; installation_id: string | null; release_id: string; account_id: string; granted_permissions: unknown; denied_permissions: unknown; high_risk_increase: boolean; idempotency_key: string; reviewed_at: Date}
  greenfield_module_install_plans: {plan_id: string; account_id: string; release_id: string; installation_id: string | null; requested_version: string; resolved_dependencies: unknown; permission_decision: unknown; status: 'created' | 'queued' | 'claimed' | 'completed' | 'failed' | 'cancelled'; idempotency_key: string; install_descriptor: unknown | null; install_descriptor_sha256: string | null; created_at: Date; updated_at: Date}
  greenfield_module_contributions: {contribution_id: string; release_id: string; module_id: string; contribution_type: 'route' | 'profileTab' | 'boardSurface' | 'setting' | 'schema' | 'tool' | 'function' | 'widget' | 'plugin' | 'connector' | 'job' | 'event'; contribution_key: string; manifest: unknown; execution_required: boolean; registration_status: 'declared' | 'registered' | 'disabled' | 'quarantined' | 'revoked'; created_at: Date; updated_at: Date}
  greenfield_module_license_evidence: {evidence_id: string; release_id: string; evidence_type: 'rootLicense' | 'packageMetadata' | 'readmeDeclaration' | 'registryMetadata' | 'maintainerStatement' | 'founderOverride' | 'firstPartyPolicy'; summary: string; source_path: string | null; checksum: string | null; created_at: Date}
  greenfield_module_release_integrity: {integrity_id: string; release_id: string; manifest_sha256: string; release_sha256: string | null; schema_sha256: unknown; settings_schema_sha256: string | null; source_commit: string; verified_at: Date | null; mismatch_at: Date | null}
  greenfield_module_release_signatures: {signature_id: string; release_id: string; signature_key_id: string; signature: string; algorithm: string; verified_at: Date | null; revoked_at: Date | null; statement: unknown | null; statement_sha256: string | null; verification_state: 'pending' | 'verified' | 'invalid' | 'unknownKey' | 'revokedKey' | null; verification_detail: string | null; public_key_fingerprint: string | null; observed_at: Date | null}
  greenfield_publisher_signing_keys: {key_id: string; publisher_id: string; algorithm: 'Ed25519'; public_key_pem: string; fingerprint: string; state: 'ACTIVE' | 'ROTATED' | 'REVOKED'; valid_from: Date; valid_until: Date | null; rotated_at: Date | null; rotated_to_key_id: string | null; revoked_at: Date | null; revocation_reason: string | null; registered_by_account_id: string | null; created_at: Date; updated_at: Date}
  greenfield_publisher_signing_key_events: {event_id: string; key_id: string; publisher_id: string; event_type: 'registered' | 'rotated' | 'revoked'; related_key_id: string | null; reason: string | null; actor_account_id: string | null; created_at: Date}
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
  greenfield_module_record_events: {event_id: string; record_id: string; account_id: string; module_id: string; collection: string; operation: 'create' | 'update' | 'delete' | 'restore' | 'move' | 'purge'; revision: number; previous_hash: string | null; event_hash: string; payload_hash: string; metadata: unknown; created_at: Date}
  greenfield_module_record_versions: {version_id: string; record_id: string; account_id: string; module_id: string; collection: string; revision: number; next_revision: number; data_snapshot: unknown; payload_hash: string; change_source: 'update' | 'restore' | 'import' | 'delete' | 'ai-assisted'; metadata: unknown; created_at: Date}
  greenfield_module_record_revisions: {revision_id: string; account_id: string; installation_id: string | null; module_id: string; record_type: string; record_id: string; revision: number; base_revision: number | null; operation: 'create' | 'update' | 'delete' | 'restore' | 'import'; mutation_id: string | null; actor_id: string | null; data_snapshot: unknown; visibility: GreenfieldModuleRuntimeVisibility; deleted: boolean; payload_hash: string; created_at: Date}
  greenfield_module_record_mutations: {mutation_row_id: string; account_id: string; installation_id: string; module_id: string; mutation_id: string; operation: 'create' | 'update' | 'delete' | 'restore'; record_type: string; record_id: string; payload_hash: string; status: 'pending' | 'completed'; result: unknown | null; created_at: Date; completed_at: Date | null}
  greenfield_module_record_references: {reference_id: string; account_id: string; source_installation_id: string | null; source_module_id: string; source_record_type: string; source_record_id: string; source_revision: number; field_path: string; ordinal: number; target_module_id: string; target_record_type: string; target_record_id: string; created_at: Date}
  greenfield_module_record_media_bindings: {binding_id: string; record_owner_account_id: string; module_id: string; record_type: string; record_id: string; asset_id: string; asset_owner_account_id: string; source_installation_id: string | null; field_path: string | null; role: string | null; order_index: number; caption: string | null; media_type: string | null; filename: string; size: string; content_type: string; created_at: Date; updated_at: Date}
  greenfield_module_record_shares: {share_id: string; owner_account_id: string; recipient_account_id: string; source_installation_id: string | null; module_id: string; record_type: string; record_id: string; permission: 'read' | 'edit'; mutation_id: string; payload_hash: string; created_at: Date; updated_at: Date; expires_at: Date | null; revoked_at: Date | null; visibility_lost_at: Date | null}
  greenfield_module_record_changes: {change_sequence: Generated<string>; account_id: string; installation_id: string | null; owner_account_id: Generated<string | null>; module_id: string; record_type: string; record_id: string; revision: number; operation: 'create' | 'update' | 'delete' | 'restore' | 'import' | 'purge' | 'bind' | 'unbind' | 'reorder' | 'metadata' | 'share' | 'permission' | 'revoke' | 'visibility-lost'; change_kind: Generated<'record' | 'media' | 'sharing' | 'visibility'>; details: Generated<unknown>; deleted: boolean; created_at: Date}
  greenfield_module_action_events: {event_id: string; account_id: string; module_id: string; action_id: string; action_kind: GreenfieldModuleActionEventKind; idempotency_key: string | null; status: 'validated' | 'completed' | 'failed' | 'queued' | 'cancelled'; input_hash: string; result: unknown; error_code: string | null; created_at: Date}
  greenfield_module_export_jobs: {export_id: string; account_id: string; module_id: string; installation_id: string | null; format: 'json' | 'markdown' | 'plain-text' | 'zip'; state: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'; manifest: unknown; record_count: number; output_ref: string | null; failure_code: string | null; created_by: string | null; created_at: Date; updated_at: Date; completed_at: Date | null}
  greenfield_module_data_retention: {retention_id: string; account_id: string; module_id: string; installation_id: string | null; choice: GreenfieldModuleDataRetentionChoice; record_count: number; export_id: string | null; completed_at: Date | null; created_at: Date}
  greenfield_module_resolved_dependencies: {resolution_id: string; plan_id: string | null; installation_id: string | null; account_id: string; release_id: string; module_id: string; relation: GreenfieldModuleDependencyRelation; target_module_id: string | null; provided_contract: string | null; requested_range: string; resolved_module_id: string | null; resolved_version: string | null; installed: boolean; satisfied: boolean; blocking: boolean; degraded: boolean; reason: string | null; created_at: Date; updated_at: Date}
  greenfield_module_permission_states: {permission_state_id: string; installation_id: string; account_id: string; release_id: string; module_id: string; permission: string; state: GreenfieldModulePermissionState; required: boolean; risk: 'low' | 'medium' | 'high' | 'critical' | 'restricted'; policy_mode: 'observe' | 'warn' | 'require-confirmation' | 'block'; reason: string; granted_at: Date | null; denied_at: Date | null; revoked_at: Date | null; updated_at: Date}
  greenfield_module_capability_registry: {capability_registration_id: string; installation_id: string; account_id: string; release_id: string; module_id: string; capability: string; provider_kind: GreenfieldModuleCapabilityProviderKind; provider_module_id: string | null; provider_installation_id: string | null; state: GreenfieldModulePermissionState; required: boolean; health_state: GreenfieldModuleCapabilityHealthState; declaration: unknown; reason: string | null; created_at: Date; updated_at: Date}
  greenfield_module_service_registrations: {service_registration_id: string; installation_id: string; account_id: string; release_id: string; module_id: string; service_id: string; service_kind: string; version: string; contract_ref: string; permissions: unknown; capabilities: unknown; input_schema_ref: string | null; output_schema_ref: string | null; status: GreenfieldModuleRegistrationStatus2; health_state: GreenfieldModuleCapabilityHealthState; timeout_ms: number; rate_limit_per_minute: number; invocation_depth_limit: number; declaration: unknown; created_at: Date; updated_at: Date}
  greenfield_module_api_registrations: {api_registration_id: string; installation_id: string; account_id: string; release_id: string; module_id: string; api_id: string; method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'; path: string; input_schema_ref: string | null; output_schema_ref: string | null; permissions: unknown; side_effects: 'none' | 'read' | 'write' | 'destructive' | 'external' | 'financial'; idempotent: boolean; status: GreenfieldModuleRegistrationStatus2; declaration: unknown; created_at: Date; updated_at: Date}
  greenfield_module_hook_registrations: {hook_registration_id: string; installation_id: string; account_id: string; release_id: string; module_id: string; hook_id: string; hook: string; phase: 'before' | 'after'; target: string; order_index: number; timeout_ms: number; failure_policy: 'observe' | 'warn' | 'require-confirmation' | 'block'; status: GreenfieldModuleRegistrationStatus2; declaration: unknown; created_at: Date; updated_at: Date}
  greenfield_module_lifecycle_transactions: {transaction_id: string; installation_id: string | null; account_id: string; release_id: string | null; module_id: string; action: GreenfieldModuleLifecycleTransactionAction; status: GreenfieldModuleLifecycleTransactionStatus; idempotency_key: string | null; rollback_policy: string; data_retention_choice: GreenfieldModuleDataRetentionChoice | null; metadata: unknown; started_at: Date; completed_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_module_lifecycle_stages: {stage_id: string; transaction_id: string; stage: string; order_index: number; status: GreenfieldModuleLifecycleStageStatus; failure_code: string | null; metadata: unknown; started_at: Date | null; completed_at: Date | null; created_at: Date}
  greenfield_module_storage_allocations: {allocation_id: string; installation_id: string; account_id: string; release_id: string; module_id: string; storage_key: string; storage_kind: GreenfieldModuleRuntimeStorageKind; scope: 'account' | 'installation'; quota_bytes: number | null; retention_policy: string; encrypted: boolean; export_supported: boolean; deletion_supported: boolean; status: GreenfieldModuleStorageAllocationStatus; declaration: unknown; created_at: Date; updated_at: Date}
  greenfield_data_resources: {resource_id: string; resource_key: string; owner_account_id: string; product_id: string; installation_id: string; release_id: string; schema_id: string; schema_version: string; primary_storage_mode: GreenfieldDataStorageMode; backend_service_id: string | null; export_handler: string; delete_handler: string; encryption_classification: GreenfieldDataEncryptionClassification; lifecycle_state: GreenfieldDataResourceState; idempotency_key: string; created_at: Date; updated_at: Date; deleted_at: Date | null}
  greenfield_data_resource_owners: {owner_binding_id: string; resource_id: string; account_id: string; owner_role: 'primary' | 'shared' | 'controller'; provenance: string; created_at: Date; released_at: Date | null}
  greenfield_data_storage_bindings: {binding_id: string; resource_id: string; storage_mode: GreenfieldDataStorageMode; service_id: string | null; locator_ref: string; credential_ref: string | null; encryption_classification: GreenfieldDataEncryptionClassification; state: GreenfieldDataStorageBindingState; metadata: unknown; created_at: Date; updated_at: Date; retired_at: Date | null}
  greenfield_data_schema_versions: {schema_version_id: string; resource_id: string; schema_id: string; version: string; definition_sha256: string | null; compatibility: GreenfieldDataSchemaCompatibility; release_id: string; state: GreenfieldDataSchemaState; declared_at: Date; activated_at: Date | null; superseded_at: Date | null}
  greenfield_data_migration_history: {migration_history_id: string; resource_id: string; migration_id: string; from_version: string; to_version: string; migration_sha256: string; reversible: boolean; state: GreenfieldDataMigrationState; attempt: number; audit_ref: string; error_class: string | null; started_at: Date | null; finished_at: Date | null; created_at: Date}
  greenfield_data_retention_policies: {retention_policy_id: string; resource_id: string; mode: GreenfieldDataRetentionMode; ttl_days: number | null; legal_hold: boolean; policy_version: string; metadata: unknown; created_at: Date; updated_at: Date}
  greenfield_data_backup_policies: {backup_policy_id: string; resource_id: string; responsibility: GreenfieldDataBackupResponsibility; mode: GreenfieldDataBackupMode; schedule_ref: string | null; recovery_point_objective_seconds: number | null; recovery_time_objective_seconds: number | null; last_backup_ref: string | null; last_backup_at: Date | null; last_restore_test_at: Date | null; metadata: unknown; created_at: Date; updated_at: Date}
  greenfield_module_secret_refs: {secret_ref: string; installation_id: string; account_id: string; module_id: string; secret_key: string; encrypted_value: Buffer; nonce: Buffer; auth_tag: Buffer; key_version: string; status: GreenfieldModuleSecretStatus; redacted_descriptor: unknown; created_at: Date; updated_at: Date}
  greenfield_module_job_registrations: {job_registration_id: string; installation_id: string; account_id: string; release_id: string; module_id: string; job_key: string; job_kind: string; function_id: string | null; schedule: string | null; retry_policy: unknown; paused: boolean; status: GreenfieldModuleJobRegistrationStatus; declaration: unknown; created_at: Date; updated_at: Date}
  greenfield_module_ui_contribution_registrations: {ui_registration_id: string; installation_id: string; account_id: string; release_id: string; module_id: string; contribution_key: string; surface: GreenfieldModuleUiContributionSurface; status: GreenfieldModuleRegistrationStatus2; declaration: unknown; created_at: Date; updated_at: Date}
  greenfield_module_service_invocations: {invocation_id: string; caller_installation_id: string; provider_installation_id: string; service_registration_id: string; account_id: string; caller_module_id: string; provider_module_id: string; service_id: string; idempotency_key: string; invocation_depth: number; status: GreenfieldModuleServiceInvocationStatus; input_hash: string; output_hash: string | null; policy_code: string; failure_code: string | null; latency_ms: number | null; redacted_input: unknown; redacted_output: unknown; created_at: Date; completed_at: Date | null}
  greenfield_extension_targets: {target_id: string; release_id: string; product_id: string; product_kind: GreenfieldExtensionProductKind; target_product_id: string; version_range: string; required_capabilities: unknown; required_extension_points: unknown; created_at: Date}
  greenfield_extension_points: {extension_point_id: string; release_id: string; product_id: string; point_key: string; title: string; contribution_kinds: unknown; required_capability: string | null; platforms: unknown; max_contributions: number; declaration: unknown; created_at: Date; updated_at: Date}
  greenfield_extension_installation_edges: {edge_id: string; account_id: string; source_installation_id: string; source_product_id: string; target_installation_id: string; target_product_id: string; relation: 'targets' | 'requires' | 'optional' | 'recommended'; version_range: string; resolved_version: string; state: 'resolved' | 'enabled' | 'disabled' | 'incompatible' | 'removed'; blocking: boolean; created_at: Date; updated_at: Date}
  greenfield_extension_contribution_registrations: {contribution_registration_id: string; account_id: string; installation_id: string; release_id: string; extension_product_id: string; target_product_id: string; target_installation_id: string | null; contribution_id: string; contribution_kind: GreenfieldExtensionContributionKind; extension_point: string; contract_id: string; required_capability: string | null; platforms: unknown; requires_online: boolean; priority: number; status: GreenfieldExtensionContributionStatus; last_error_code: string | null; declaration: unknown; created_at: Date; updated_at: Date}
  greenfield_extension_capability_grants: {grant_id: string; account_id: string; consumer_installation_id: string; consumer_product_id: string; target_installation_id: string; target_product_id: string; capability: string; state: GreenfieldExtensionGrantState; scope_type: 'installation' | 'resource' | 'action'; scope_ref: string | null; approved_by_account_id: string | null; approved_at: Date | null; revoked_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_extension_service_assertions: {assertion_id: string; jti: string; account_id: string; consumer_installation_id: string; consumer_product_id: string; target_installation_id: string; target_product_id: string; service_id: string; action_id: string; capabilities: unknown; scope_type: 'installation' | 'resource' | 'action'; scope_ref: string | null; token_hash: string; raw_user_bearer_forwarded: false; request_id: string; issued_at: Date; expires_at: Date; consumed_at: Date | null; revoked_at: Date | null; created_at: Date}
  greenfield_extension_event_subscriptions: {subscription_id: string; account_id: string; installation_id: string; extension_product_id: string; target_product_id: string; event_type: string; event_version: number; required_capability: string; status: 'registered' | 'enabled' | 'disabled' | 'failed' | 'quarantined' | 'removed'; last_delivery_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_extension_job_executions: {execution_id: string; job_registration_id: string | null; account_id: string; owner_installation_id: string; extension_product_id: string; target_product_id: string; action_id: string; status: GreenfieldExtensionJobStatus; attempt_count: number; maximum_attempts: number; idempotency_key: string; request_id: string; failure_code: string | null; input_hash: string; redacted_metadata: unknown; available_at: Date; started_at: Date | null; completed_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_extension_entity_metadata: {metadata_id: string; account_id: string; owner_installation_id: string; extension_product_id: string; target_product_id: string; entity_type: string; entity_id: string; namespace: string; value: unknown; created_at: Date; updated_at: Date}
  greenfield_extension_runtime_projection: {installation_id: string; account_id: string; product_id: string; product_kind: GreenfieldExtensionProductKind; release_id: string; version: string; state: GreenfieldExtensionRuntimeState; health_state: 'healthy' | 'degraded' | 'unavailable' | 'configuration-required' | 'disabled' | 'quarantined' | 'failed'; last_error_code: string | null; last_error_message: string | null; projected_at: Date; updated_at: Date}
  greenfield_engine_registrations: {engine_id: string; version: string; execution_mode: GreenfieldEngineExecutionMode; runtime_status: GreenfieldEngineRuntimeStatus; package_name: string; source_repository: string; source_revision: string; trusted_platform: boolean; health: unknown; created_at: Date; updated_at: Date}
  greenfield_engine_capability_registrations: {engine_id: string; capability: string; version: number; operations: unknown; sensitive: boolean; availability: GreenfieldEngineCapabilityAvailability; created_at: Date}
  greenfield_engine_service_registrations: {engine_id: string; service_id: string; execution_mode: Exclude<GreenfieldEngineExecutionMode, 'CONTRACT_ONLY'>; audience: string; protocol_version: string; actions: unknown; required_capabilities: unknown; health_path: string; timeout_ms: number; tls_required: boolean; created_at: Date; updated_at: Date}
  greenfield_engine_job_registrations: {engine_id: string; action: string; version: number; timeout_seconds: number; maximum_attempts: number; active: boolean; created_at: Date}
  greenfield_engine_event_consumer_registrations: {engine_id: string; event_type: string; schema_version: number; active: boolean; created_at: Date}
  greenfield_engine_usage_metric_registrations: {engine_id: string; metric: string; active: boolean; created_at: Date}
  module_backend_definitions: {definition_id: string; release_id: string; module_id: string; mode: ModuleBackendMode; protocol_version: string | null; endpoint_strategy: string | null; discovery_path: string | null; health_path: string | null; backend: unknown; trust: unknown; data: unknown; deployment: unknown; network_policy: unknown; actions: unknown; created_at: Date; updated_at: Date}
  module_backend_installations: {backend_installation_id: string; installation_id: string; release_id: string; account_id: string; module_id: string; mode: ModuleBackendMode; resolved_origin: string | null; lifecycle_state: ModuleBackendLifecycleState; protocol_version: string | null; discovery: unknown; capabilities: unknown; verification_status: ModuleBackendVerificationStatus; verification_errors: unknown; last_verified_at: Date | null; last_health_at: Date | null; enabled_at: Date | null; disabled_at: Date | null; created_at: Date; updated_at: Date}
  module_backend_sessions: {session_id: string; installation_id: string; module_id: string; account_id: string; actor_id: string | null; audience: string; token_hash: string; permissions: unknown; capabilities: unknown; issued_at: Date; expires_at: Date; revoked_at: Date | null; request_id: string | null; created_at: Date}
  module_backend_health: {health_id: string; installation_id: string; module_id: string; component: ModuleBackendHealthComponent; status: ModuleBackendHealthStatus; latency_ms: number | null; failure_count: number; circuit_state: ModuleBackendCircuitState; redacted_details: unknown; checked_at: Date}
  module_backend_capabilities: {capability_id: string; installation_id: string; module_id: string; capability: string; provider: ModuleBackendCapabilityProvider; available: boolean; granted: boolean; reason: string | null; updated_at: Date}
  module_backend_event_subscriptions: {subscription_id: string; installation_id: string; module_id: string; event_type: string; direction: ModuleBackendEventDirection; allowed: boolean; signature_required: boolean; replay_window_seconds: number; created_at: Date; updated_at: Date}
  module_backend_event_deliveries: {delivery_id: string; installation_id: string; module_id: string; event_id: string; event_type: string; direction: ModuleBackendEventDirection; status: ModuleBackendDeliveryStatus; idempotency_key: string | null; payload_hash: string; failure_code: string | null; redacted_details: unknown; created_at: Date; updated_at: Date}
  module_backend_webhook_deliveries: {webhook_delivery_id: string; installation_id: string; module_id: string; webhook_id: string; event_type: string; direction: ModuleBackendWebhookDirection; status: ModuleBackendDeliveryStatus; idempotency_key: string | null; payload_hash: string; signature_valid: boolean; failure_code: string | null; redacted_details: unknown; created_at: Date; updated_at: Date}
  module_backend_failures: {failure_id: string; installation_id: string | null; release_id: string | null; module_id: string; failure_type: ModuleBackendFailureType; reason_code: string; redacted_details: unknown; occurred_at: Date}
  greenfield_ai_providers: {provider_id: string; provider_kind: GreenfieldAIProviderKind; display_name: string; status: GreenfieldAIProviderStatus; configuration_mode: GreenfieldAIProviderConfigurationMode; capabilities: unknown; metadata: unknown; created_at: Date; updated_at: Date}
  greenfield_ai_models: {model_id: string; provider_id: string; provider_kind: GreenfieldAIProviderKind; provider_model_id: string; display_name: string; capabilities: unknown; supports_streaming: boolean; supports_structured_outputs: boolean; supports_reasoning: boolean; supports_vision: boolean; supports_image_generation: boolean; supports_embeddings: boolean; supports_audio: boolean; availability: GreenfieldAIModelAvailability; lifecycle_status: GreenfieldAIModelLifecycleStatus; enabled: boolean; policy_tags: unknown; limits: unknown; created_at: Date; updated_at: Date}
  greenfield_ai_prompts: {prompt_id: string; version: string; owner: string; module_id: string | null; purpose: string; variables: unknown; output_schema: unknown; safety_policy: unknown; lifecycle_status: GreenfieldAIPromptLifecycleStatus; prompt_template: string; template_hash: string; created_at: Date; updated_at: Date}
  greenfield_ai_request_ledger: {request_id: string; requesting_module_id: string; account_id: string; actor_id: string | null; installation_id: string | null; conversation_id: string | null; correlation_id: string; provider_id: string | null; model_id: string | null; prompt_id: string | null; prompt_version: string | null; required_capabilities: unknown; policy_context: unknown; response_schema: unknown; safety_requirements: unknown; context_summary: unknown; streaming_requested: boolean; streaming_used: boolean; status: GreenfieldAIRequestStatus; timeout_ms: number; latency_ms: number | null; input_tokens: number | null; output_tokens: number | null; total_tokens: number | null; estimated_cost_microunits: number | null; retry_count: number; failure_code: string | null; started_at: Date | null; completed_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_ai_tool_declarations: {tool_id: string; module_id: string; installation_id: string | null; version: string; description: string; input_schema: unknown; output_schema: unknown; side_effects: GreenfieldAIToolSideEffect; confirmation: GreenfieldAIToolConfirmation; required_permissions: unknown; lifecycle_status: 'active' | 'disabled' | 'deprecated' | 'retired'; created_at: Date; updated_at: Date}
  greenfield_ai_tool_runs: {tool_run_id: string; request_id: string | null; tool_id: string; module_id: string; installation_id: string | null; account_id: string; actor_id: string | null; argument_hash: string; status: GreenfieldAIToolRunStatus; confirmation_status: GreenfieldAIToolConfirmationStatus; failure_code: string | null; redacted_details: unknown; created_at: Date; completed_at: Date | null}
  greenfield_ai_streams: {stream_id: string; request_id: string; account_id: string; actor_id: string | null; module_id: string; correlation_id: string; status: GreenfieldAIStreamStatus; last_sequence: number; structured_completion: unknown; usage_delta: unknown; cancellation_requested_at: Date | null; reconnect_expires_at: Date | null; created_at: Date; updated_at: Date; completed_at: Date | null}
  ai_provider_credentials: {credential_id: string; provider_id: string; scope_type: AIProviderCredentialScopeType; scope_id: string | null; encrypted_payload: Buffer; encryption_key_version: string; nonce: Buffer; authentication_tag: Buffer; status: AIProviderCredentialStatus; created_at: Date; updated_at: Date; rotated_at: Date | null; last_verified_at: Date | null; last_verification_code: string | null}
  ai_provider_runtime_state: {state_id: string; provider_id: string; model_id: string | null; circuit_state: AICircuitState; failure_count: number; success_count: number; rolling_window_started_at: Date; circuit_opened_at: Date | null; half_open_probe_count: number; last_failure_code: string | null; config: unknown; updated_at: Date}
  ai_executions: {execution_id: string; request_id: string; account_id: string; actor_id: string | null; module_id: string; installation_id: string | null; provider_id: string | null; model_id: string | null; prompt_id: string | null; prompt_version: string | null; status: AIExecutionStatus; streaming: boolean; structured_output: boolean; started_at: Date | null; completed_at: Date | null; cancelled_at: Date | null; failed_at: Date | null; failure_code: string | null; request_metadata: unknown; response_metadata: unknown; created_at: Date; updated_at: Date}
  ai_execution_attempts: {attempt_id: string; execution_id: string; provider_id: string; model_id: string; attempt_number: number; status: AIExecutionAttemptStatus; started_at: Date | null; completed_at: Date | null; latency_ms: number | null; failure_code: string | null; retryable: boolean; request_metadata: unknown; response_metadata: unknown}
  ai_stream_sessions: {stream_id: string; execution_id: string; account_id: string; actor_id: string | null; module_id: string; installation_id: string | null; cursor: string; reconnect_token_hash: string; status: GreenfieldAIStreamStatus; last_event_sequence: number; expires_at: Date; cancellation_requested_at: Date | null; created_at: Date; updated_at: Date; completed_at: Date | null}
  ai_stream_events: {event_id: string; stream_id: string; sequence: number; event_type: 'execution.started' | 'content.delta' | 'reasoning.status' | 'tool.requested' | 'usage.updated' | 'execution.completed' | 'execution.failed' | 'execution.cancelled' | 'heartbeat'; event_payload: unknown; created_at: Date; expires_at: Date}
  ai_provider_health: {health_id: string; provider_id: string; model_id: string | null; component: AIProviderHealthComponent; state: AIProviderHealthState; checked_at: Date; latency_ms: number | null; failure_code: string | null; failure_rate: number; rate_limit_state: unknown; configured_model_count: number; successful_execution_count: number; failed_execution_count: number; active_stream_count: number; diagnostics: unknown}
  ai_usage_limits: {limit_id: string; scope_type: AIUsageLimitScope; scope_id: string | null; provider_id: string | null; model_id: string | null; limit_kind: AIUsageLimitKind; unit: AIQuotaUnit; window_seconds: number; limit_value: number; enabled: boolean; metadata: unknown; created_at: Date; updated_at: Date}
  ai_quota_consumption: {consumption_id: string; limit_id: string | null; scope_type: AIUsageLimitScope; scope_id: string | null; provider_id: string | null; model_id: string | null; bucket_start: Date; bucket_end: Date; unit: AIQuotaUnit; consumed_units: number; request_count: number; currency: string | null; updated_at: Date}
  ai_product_action_executions: {product_execution_id: string; ai_execution_id: string | null; request_id: string; account_id: string; actor_id: string | null; module_id: string; installation_id: string | null; action_id: string; prompt_id: string; prompt_version: string; record_id: string; source_revision: number; application_mode: 'preview-only' | 'replace-selection' | 'replace-document' | 'insert' | 'metadata-suggestion'; status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled' | 'expired'; application_status: 'not-applicable' | 'pending' | 'applied' | 'rejected' | 'expired'; stream_path: string | null; context_summary: unknown; request_metadata: unknown; usage_metadata: unknown; failure_code: string | null; expires_at: Date; created_at: Date; updated_at: Date; completed_at: Date | null; applied_at: Date | null}
  ai_product_action_results: {result_id: string; product_execution_id: string; result_hash: string; result_data: unknown; schema_ref: string; status: 'available' | 'applied' | 'rejected' | 'expired'; expires_at: Date; created_at: Date; applied_at: Date | null}
  ai_product_action_applications: {application_id: string; product_execution_id: string; account_id: string; module_id: string; installation_id: string | null; action_id: string; record_id: string; source_revision: number; resulting_revision: number; result_hash: string; idempotency_key: string; metadata: unknown; created_at: Date}
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
  greenfield_developer_profiles: {account_id: string; display_name: string; biography: string; website: string | null; status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'; created_at: Date; updated_at: Date}
  greenfield_developer_organisations: {organisation_id: string; slug: string; display_name: string; status: 'ACTIVE' | 'SUSPENDED' | 'CLOSED'; created_by_account_id: string; created_at: Date; updated_at: Date}
  greenfield_developer_organisation_memberships: {membership_id: string; organisation_id: string; account_id: string; role: 'OWNER' | 'ADMIN' | 'DEVELOPER' | 'RELEASE_MANAGER' | 'VIEWER'; state: 'INVITED' | 'ACTIVE' | 'SUSPENDED' | 'REMOVED'; invited_by_account_id: string | null; created_at: Date; updated_at: Date}
  greenfield_publisher_owners: {publisher_owner_id: string; publisher_id: string; owner_type: 'ACCOUNT' | 'ORGANISATION'; account_id: string | null; organisation_id: string | null; created_at: Date}
  greenfield_developer_agreements: {agreement_id: string; version: string; document_hash: string; effective_at: Date; superseded_at: Date | null; created_at: Date}
  greenfield_developer_agreement_acceptances: {acceptance_id: string; agreement_id: string; agreement_version: string; accepted_by_account_id: string; accepted_at: Date; document_hash: string}
  greenfield_developer_programme_memberships: {programme_membership_id: string; account_id: string | null; organisation_id: string | null; state: DeveloperProgrammeState; state_reason: string | null; started_at: Date | null; ended_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_developer_products: {product_id: string; publisher_id: string; owner_account_id: string | null; owner_organisation_id: string | null; extension_id: string | null; kind: DeveloperProductKind; display_name: string; description: string; visibility: DeveloperProductVisibility; state: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'; created_at: Date; updated_at: Date}
  greenfield_developer_source_connections: {source_connection_id: string; product_id: string; provider: 'github' | 'gitlab' | 'bitbucket' | 'self-hosted-git'; repository: string; repository_id: string | null; default_branch: string; credential_ref: string | null; state: 'PENDING' | 'ACTIVE' | 'REVOKED' | 'ERROR'; created_by_account_id: string; created_at: Date; updated_at: Date; revoked_at: Date | null}
  greenfield_developer_builds: {build_id: string; product_id: string; source_connection_id: string | null; source_sha: string; state: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'QUARANTINED'; builder_identity: string; artifact_ref: string | null; artifact_sha256: string | null; sbom_ref: string | null; provenance_ref: string | null; created_by_account_id: string; created_at: Date; started_at: Date | null; finished_at: Date | null; request_id: string; idempotency_key: string | null; attempt_count: number; maximum_attempts: number; lease_owner: string | null; lease_expires_at: Date | null; failure_code: string | null; failure_summary: string | null; manifest_sha256: string | null; sbom_sha256: string | null; licence_inventory_ref: string | null; provenance_signature: string | null}
  greenfield_developer_releases: {developer_release_id: string; product_id: string; build_id: string; module_release_id: string | null; version: string; channel: DeveloperReleaseChannel; state: 'DRAFT' | 'CANDIDATE' | 'QUARANTINED' | 'RELEASED' | 'REVOKED' | 'SUPERSEDED'; released_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_developer_test_groups: {test_group_id: string; product_id: string; name: string; kind: 'OWNER' | 'TEAM' | 'INTERNAL' | 'ALPHA' | 'BETA' | 'NAMED'; created_by_account_id: string; created_at: Date; updated_at: Date}
  greenfield_developer_test_group_members: {test_group_id: string; account_id: string; state: 'INVITED' | 'ACTIVE' | 'REMOVED'; added_at: Date}
  greenfield_developer_release_test_groups: {developer_release_id: string; test_group_id: string; assigned_at: Date}
  greenfield_developer_review_submissions: {review_submission_id: string; product_id: string; developer_release_id: string | null; state: DeveloperReviewState; checks: unknown; submitted_by_account_id: string; reviewer_account_id: string | null; decision_reason: string | null; submitted_at: Date | null; decided_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_build_service_registrations: {service_id: string; display_name: string; public_key_pem: string; signing_key_id: string; runner_image: string; state: 'ACTIVE' | 'DISABLED' | 'QUARANTINED'; registered_by_account_id: string; registered_at: Date; updated_at: Date; last_health_at: Date | null}
  greenfield_build_provenance: {build_id: string; service_id: string; signing_key_id: string; source_repository: string; source_sha: string; builder_identity: string; build_profile: string; artifact_sha256: string; manifest_sha256: string; sbom_sha256: string; licence_inventory_sha256: string; signature: string; signature_verified: true; verified_at: Date; created_at: Date}
  greenfield_build_claim_requests: {service_id: string; request_id: string; payload_sha256: string; response: unknown; claimed_at: Date}
  greenfield_build_result_receipts: {receipt_id: string; build_id: string; service_id: string; payload_sha256: string; service_signature_verified: boolean; result_state: 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'QUARANTINED'; failure_code: string | null; received_at: Date}
  greenfield_release_review_checks: {review_check_id: string; review_submission_id: string; check_kind: 'manifest' | 'permissions' | 'network' | 'backend' | 'storage' | 'dependencies' | 'provenance' | 'licence' | 'security' | 'compatibility' | 'export-delete'; state: 'PENDING' | 'PASS' | 'FAIL' | 'NOT_APPLICABLE'; evidence_ref: string | null; failure_code: string | null; checked_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_offers: {offer_id: string; product_id: string; kind: 'FREE' | 'ONE_TIME' | 'SUBSCRIPTION' | 'FREEMIUM' | 'TRIAL' | 'BUNDLE' | 'ENTERPRISE' | 'PRIVATE'; display_name: string; capabilities: unknown; commercial_terms: unknown; trial_duration_seconds: number | null; state: 'DRAFT' | 'ACTIVE' | 'RETIRED'; created_by_account_id: string; created_at: Date; updated_at: Date}
  greenfield_billing_adapter_registrations: {adapter: 'APPLE' | 'GOOGLE' | 'WEB' | 'ENTERPRISE_ADMIN'; state: 'NOT_CONFIGURED' | 'ACTIVE' | 'DEGRADED' | 'DISABLED'; service_id: string | null; configuration_ref: string | null; last_verified_at: Date | null; updated_at: Date}
  greenfield_external_billing_receipts: {receipt_id: string; adapter: 'APPLE' | 'GOOGLE' | 'WEB' | 'ENTERPRISE_ADMIN'; external_transaction_id: string; owner_account_id: string | null; owner_organisation_id: string | null; product_id: string; offer_id: string; state: 'OBSERVED' | 'VERIFIED' | 'REJECTED' | 'REVOKED'; evidence_hash: string; verified_by_service_id: string | null; observed_at: Date; created_at: Date}
  greenfield_entitlements: {entitlement_id: string; owner_type: 'ACCOUNT' | 'ORGANISATION'; owner_account_id: string | null; owner_organisation_id: string | null; product_id: string; offer_id: string; source: 'FREE' | 'TRIAL' | 'APPLE' | 'GOOGLE' | 'WEB' | 'ENTERPRISE' | 'ADMIN'; state: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'REVOKED'; external_receipt_id: string | null; provenance_reference: string; started_at: Date; expires_at: Date | null; created_at: Date; updated_at: Date}
  greenfield_entitlement_capabilities: {entitlement_id: string; capability: string; created_at: Date}
  greenfield_entitlement_events: {entitlement_event_id: string; entitlement_id: string; event_type: 'GRANTED' | 'STATE_CHANGED' | 'EXPIRED' | 'REVOKED'; previous_state: string | null; state: 'TRIAL' | 'ACTIVE' | 'GRACE' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED' | 'REVOKED'; actor_type: 'ACCOUNT' | 'SERVICE' | 'SYSTEM'; actor_id: string; reason_code: string; provenance_reference: string; occurred_at: Date}
  greenfield_usage_events: {usage_event_id: string; account_id: string; organisation_id: string | null; product_id: string; installation_id: string | null; entitlement_id: string | null; capability: string; metric: 'ai.request' | 'ai.tokens' | 'storage.bytes' | 'transcription.seconds' | 'media.processing' | 'render.time' | 'function.invocation' | 'job.execution' | 'game.session'; quantity: number; unit: string; producer_service_id: string; idempotency_key: string; payload_hash: string; trace_id: string; occurred_at: Date; recorded_at: Date}
  greenfield_quota_policies: {quota_policy_id: string; scope_type: 'ACCOUNT' | 'ORGANISATION' | 'PRODUCT' | 'ENTITLEMENT' | 'CAPABILITY'; scope_id: string; metric: Database['greenfield_usage_events']['metric']; limit_quantity: number; window_seconds: number; state: 'ACTIVE' | 'DISABLED' | 'RETIRED'; created_by_account_id: string; created_at: Date; updated_at: Date}
  greenfield_quota_counters: {quota_policy_id: string; bucket_start: Date; bucket_end: Date; consumed_quantity: number; updated_at: Date}
  greenfield_account_data_requests: {data_request_id: string; account_id: string; request_type: 'EXPORT' | 'DELETE'; state: 'DISCOVERING' | 'COLLECTING' | 'READY' | 'WAITING_RETENTION' | 'DELETING' | 'COMPLETED' | 'FAILED' | 'CANCELLED'; idempotency_key: string; requested_by_account_id: string; recent_auth_strength: string | null; integrity_manifest: unknown | null; not_before: Date | null; expires_at: Date | null; failure_code: string | null; created_at: Date; updated_at: Date; completed_at: Date | null; cancelled_at: Date | null}
  greenfield_account_data_request_domains: {data_request_domain_id: string; data_request_id: string; domain_key: string; domain_kind: 'GREENFIELD_CORE' | 'GREENFIELD_RECORDS' | 'MODULE_SERVICE' | 'OBJECT_STORAGE' | 'EXTERNAL_SERVICE'; product_id: string | null; installation_id: string | null; resource_id: string | null; handler: string; state: 'PENDING' | 'CLAIMED' | 'SUCCEEDED' | 'RETAINED' | 'FAILED' | 'SKIPPED'; retention_decision: 'DELETE' | 'RETAIN_LEGAL_HOLD' | 'RETAIN_POLICY' | 'NOT_APPLICABLE' | null; claimed_by_service_id: string | null; claim_expires_at: Date | null; failure_code: string | null; created_at: Date; updated_at: Date; completed_at: Date | null}
  greenfield_account_data_artifacts: {artifact_id: string; data_request_id: string; data_request_domain_id: string; artifact_ref: string; sha256: string; media_type: string; byte_length: number; payload: unknown | null; created_at: Date; expires_at: Date | null}
  greenfield_account_deletion_tombstones: {account_id: string; data_request_id: string; retained_domains: unknown; deletion_manifest_sha256: string; completed_at: Date}
  greenfield_story_groups: {
    group_id: string
    owner_actor_id: string
    visibility: 'public' | 'followers' | 'close'
    expires_at: Date
    created_at: Date
    updated_at: Date
    deleted_at: Date | null
  }
  greenfield_story_items: {
    item_id: string
    group_id: string
    media_kind: 'image' | 'video'
    media_url: string | null
    media_file_name: string | null
    caption: string | null
    status: 'uploading' | 'ready' | 'failed'
    sort_order: number
    duration_ms: number | null
    created_at: Date
    deleted_at: Date | null
  }
  greenfield_story_views: {
    view_id: string
    item_id: string
    viewer_actor_id: string
    viewed_at: Date
  }
  greenfield_product_families: {family_id: string; display_name: string; created_at: Date; updated_at: Date}
  greenfield_product_family_members: {family_id: string; product_id: string; member_role: 'root' | 'member'; created_at: Date}
  greenfield_product_relationships: {relationship_id: string; product_id: string; relationship_type: 'belongsToFamily' | 'extends' | 'targets' | 'requires' | 'optionallyRequires' | 'replaces' | 'supersedes' | 'compatibleWith' | 'providesFor'; target_product_id: string; version_range: string | null; created_at: Date}
  greenfield_product_identity_aliases: {alias_id: string; canonical_product_id: string; reason: string; created_at: Date}
  greenfield_mps_ingestions: {ingestion_id: string; product_id: string; version: string; release_id: string | null; manifest_sha256: string; product_standard: string; manifest_format: string; registry_kind: GreenfieldExtensionProductKind; frontend_mode: 'none' | 'declarative' | 'host-contribution'; backend_mode: 'none' | 'greenfield-records' | 'service' | 'engine-backed'; storage_mode: string | null; greenfield_backend_mode: string; test_fixture: boolean; visibility: string; manifest: unknown; projection: unknown; ingested_at: Date}
  greenfield_release_presentation_assets: {asset_id: string; ingestion_id: string; release_id: string | null; product_id: string; version: string; role: string; artifact_path: string; media_type: string; width: number | null; height: number | null; sha256: string | null; development_asset: boolean; alt_text: string | null; presentation_slot: string | null; sort_order: number; created_at: Date}
  greenfield_release_asset_blobs: {sha256: string; media_type: string; byte_size: number; bytes: Buffer; created_at: Date}
  greenfield_release_frontends: {frontend_id: string; ingestion_id: string; release_id: string | null; product_id: string; version: string; frontend_mode: 'declarative' | 'host-contribution'; artifact_role: 'product.frontend'; artifact_path: string; media_type: 'application/vnd.modula.frontend+json'; artifact_sha256: string; schema_version: '1.0.0'; mps_version: '1.0-RC' | '1.0'; entry_view: string | null; route_count: number; routes: unknown; compatibility: unknown; required_capabilities: unknown; runtime_projection: unknown; verified_at: Date; created_at: Date}
  greenfield_product_privacy_declarations: {ingestion_id: string; product_id: string; version: string; data_accessed: unknown; data_created: unknown; data_transmitted: unknown; processors: unknown; retention: string | null; export_policy: string | null; deletion_policy: string | null; telemetry: string | null; declaration: unknown; created_at: Date}
  intelligence_missions: {mission_id: string; owner_account_id: string; workspace_id: string | null; objective: string; status: IntelligenceMissionStatus; correlation_id: string; created_at: Date; updated_at: Date; completed_at: Date | null}
  intelligence_plans: {plan_id: string; mission_id: string; version: number; summary: string; created_at: Date}
  intelligence_plan_steps: {step_id: string; plan_id: string; mission_id: string; order_index: number; description: string; capability: string; dependencies: unknown; state: 'pending' | 'ready' | 'authorized' | 'running' | 'completed' | 'failed' | 'blocked'; created_at: Date; updated_at: Date}
  intelligence_proposals: {proposal_id: string; mission_id: string; plan_id: string; step_id: string; module_id: string | null; family: string; capability: string; action_id: string | null; input: unknown; requested_by: 'gaia'; idempotency_key: string | null; created_at: Date}
  intelligence_evidence: {evidence_id: string; mission_id: string; proposal_id: string | null; kind: 'record' | 'document' | 'api' | 'user_input' | 'system' | 'derived'; source_id: string | null; uri: string | null; content_hash: string | null; captured_at: Date | null; metadata: unknown; created_at: Date}
  intelligence_aki_decisions: {decision_id: string; mission_id: string; proposal_id: string; verdict: 'allow' | 'allow_with_conditions' | 'require_approval' | 'deny' | 'abstain'; risk: IntelligenceRisk; reversibility: 'reversible' | 'compensatable' | 'irreversible'; checks: unknown; evidence_state: 'EVIDENCE_PRESENT' | 'NO_EVIDENCE' | 'INSUFFICIENT_EVIDENCE' | 'CONFLICTING_EVIDENCE'; conflicts: unknown; conditions: unknown; confidence: number | null; created_at: Date}
  intelligence_governor_decisions: {governor_decision_id: string; mission_id: string; proposal_id: string; aki_decision_id: string; authorization_state: 'autonomous' | 'supervised' | 'human_required' | 'blocked'; allowed_capabilities: unknown; constraints: unknown; created_at: Date}
  intelligence_approvals: {approval_id: string; mission_id: string; proposal_id: string; requested_account_id: string; resolver_account_id: string | null; reason: string; status: IntelligenceApprovalStatus; requested_at: Date; resolved_at: Date | null; expires_at: Date | null}
  intelligence_runs: {execution_id: string; mission_id: string; proposal_id: string; governor_decision_id: string; approval_id: string | null; status: IntelligenceExecutionStatus; idempotency_key: string | null; result: unknown | null; error_code: string | null; started_at: Date | null; completed_at: Date | null; created_at: Date}
  intelligence_run_steps: {run_step_id: string; execution_id: string; plan_step_id: string; status: IntelligenceExecutionStatus; started_at: Date | null; completed_at: Date | null; error_code: string | null}
  intelligence_artifacts: {artifact_id: string; mission_id: string; execution_id: string; kind: string; media_type: string; uri: string | null; content_hash: string | null; metadata: unknown; created_at: Date}
  intelligence_ledger_events: {event_id: string; schema_version: '1.0.0'; event_type: string; occurred_at: Date; actor_type: 'user' | 'gaia' | 'aki' | 'governor' | 'command' | 'runtime' | 'system'; actor_id: string | null; mission_id: string; correlation_id: string; owner_account_id: string | null; workspace_id: string | null; proposal_id: string | null; aki_decision_id: string | null; governor_decision_id: string | null; approval_id: string | null; execution_id: string | null; artifact_id: string | null; payload: unknown}
  intelligence_circuits: {circuit_id: string; owner_account_id: string; workspace_id: string | null; name: string; state: 'draft' | 'validating' | 'active' | 'deprecated' | 'quarantined'; active_revision_id: string | null; created_at: Date; updated_at: Date}
  intelligence_circuit_revisions: {revision_id: string; circuit_id: string; version: number; definition: unknown; created_by_account_id: string; created_at: Date}
}
