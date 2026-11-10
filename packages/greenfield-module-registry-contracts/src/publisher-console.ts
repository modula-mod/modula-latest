/**
 * BUILDER-01 publisher Module Release Console HTTP contract.
 *
 * Generic for every publisher: no product-specific routes or fields. Every
 * route requires an authenticated Greenfield session AND publisher access
 * (publisher owner account, or ACTIVE org membership with role OWNER, ADMIN,
 * DEVELOPER or RELEASE_MANAGER) for the module's publisher. Founder admin
 * handles are NOT publisher authority on this path.
 *
 * All responses use the standard Greenfield envelope:
 *   success: {ok: true, data: T, meta: {requestId, serverTime}}
 *   failure: {ok: false, error: {code: ApiErrorCode, message, requestId, retryable,
 *             details: {publisherConsoleCode: PublisherConsoleErrorCode, ...}}, meta}
 * `error.code` stays inside the frozen v1 ApiErrorCode set (FORBIDDEN, NOT_FOUND,
 * CONFLICT, VALIDATION_FAILED, UNAUTHENTICATED, SERVER_ERROR); the stable
 * console-specific reason is `error.details.publisherConsoleCode`.
 *
 * Routes (complete set):
 *   GET  /v1/publisher/modules                                  -> PublisherModuleSummary[]
 *   GET  /v1/publisher/modules/:moduleId                         -> PublisherModuleDetail
 *   GET  /v1/publisher/modules/:moduleId/versions                -> PublisherModuleVersion[]
 *   GET  /v1/publisher/modules/:moduleId/github-releases         -> PublisherGithubSourceRelease[]
 *   GET  /v1/publisher/modules/:moduleId/release-jobs            -> PublisherReleaseJob[]
 *   GET  /v1/publisher/modules/:moduleId/signing-identities      -> PublisherOnlineSigningIdentityPublicView[]
 *   POST /v1/publisher/modules/:moduleId/release-jobs            CreatePublisherReleaseJobRequest -> 202 PublisherReleaseJob (200 on idempotent replay)
 *   GET  /v1/publisher/release-jobs/:jobId                       -> PublisherReleaseJob
 *   GET  /v1/publisher/release-jobs/:jobId/logs                  -> PublisherReleaseJobLogPage
 *   GET  /v1/publisher/release-jobs/:jobId/signing               -> PublisherReleaseSigningStatus
 *   POST /v1/publisher/release-jobs/:jobId/validate              -> 202 PublisherReleaseJob
 *   POST /v1/publisher/release-jobs/:jobId/sign                  -> 202 PublisherReleaseJob
 *   POST /v1/publisher/release-jobs/:jobId/publish               PublishPublisherReleaseJobRequest -> 202 PublisherReleaseJob
 *   POST /v1/publisher/release-jobs/:jobId/cancel                -> 200 PublisherReleaseJob
 *   POST /v1/publisher/release-jobs/:jobId/resume                -> 202 PublisherReleaseJob
 */

export const PUBLISHER_RELEASE_JOB_STATES = [
  'created',
  'fetching',
  'validating',
  'signature_missing',
  'signature_invalid',
  'ready_for_signing',
  'signing',
  'signature_verified',
  'signing_failed',
  'validation_failed',
  'ready_for_review',
  'publishing',
  'published',
  'cancelled',
  'failed',
  'conflicted',
] as const

export type PublisherReleaseJobState = (typeof PUBLISHER_RELEASE_JOB_STATES)[number]

/** States that hold the moduleId@version / moduleId+releaseTag in-flight lock. */
export const PUBLISHER_RELEASE_JOB_IN_FLIGHT_STATES = [
  'created',
  'fetching',
  'validating',
  'ready_for_signing',
  'signing',
  'signature_verified',
  'ready_for_review',
  'publishing',
] as const satisfies readonly PublisherReleaseJobState[]

export type PublisherConsoleErrorCode =
  | 'UNAUTHENTICATED'
  | 'INVALID_REQUEST'
  | 'FORBIDDEN_NOT_PUBLISHER'
  | 'MODULE_NOT_FOUND'
  | 'JOB_NOT_FOUND'
  | 'INVALID_SOURCE_RELEASE'
  | 'INVALID_JOB_STATE'
  | 'VERSION_CONFLICT'
  | 'JOB_IN_FLIGHT'
  | 'VALIDATION_FAILED'
  | 'SIGNATURE_MISSING'
  | 'SIGNATURE_INVALID'
  | 'SIGNATURE_REVOKED'
  | 'SIGNING_NOT_CONFIGURED'
  | 'SIGNING_AUTHORIZATION_REQUIRED'
  | 'SIGNING_IDENTITY_UNAVAILABLE'
  | 'SIGNING_RATE_LIMITED'
  | 'SIGNING_FAILED'
  | 'RELEASE_APPROVAL_INVALIDATED'
  | 'PERMISSION_EXPANSION_UNACKNOWLEDGED'
  | 'IDEMPOTENCY_KEY_CONFLICT'
  | 'CANCEL_NOT_ALLOWED'
  | 'RESUME_NOT_ALLOWED'
  | 'GITHUB_UNAVAILABLE'
  | 'INTERNAL_ERROR'

/** HTTP status used for each console error code. */
export const PUBLISHER_CONSOLE_ERROR_HTTP_STATUS: Readonly<Record<PublisherConsoleErrorCode, number>> = {
  UNAUTHENTICATED: 401,
  INVALID_REQUEST: 400,
  FORBIDDEN_NOT_PUBLISHER: 403,
  MODULE_NOT_FOUND: 404,
  JOB_NOT_FOUND: 404,
  INVALID_SOURCE_RELEASE: 400,
  INVALID_JOB_STATE: 409,
  VERSION_CONFLICT: 409,
  JOB_IN_FLIGHT: 409,
  VALIDATION_FAILED: 409,
  SIGNATURE_MISSING: 409,
  SIGNATURE_INVALID: 409,
  SIGNATURE_REVOKED: 409,
  SIGNING_NOT_CONFIGURED: 503,
  SIGNING_AUTHORIZATION_REQUIRED: 403,
  SIGNING_IDENTITY_UNAVAILABLE: 409,
  SIGNING_RATE_LIMITED: 429,
  SIGNING_FAILED: 503,
  RELEASE_APPROVAL_INVALIDATED: 409,
  PERMISSION_EXPANSION_UNACKNOWLEDGED: 409,
  IDEMPOTENCY_KEY_CONFLICT: 409,
  CANCEL_NOT_ALLOWED: 409,
  RESUME_NOT_ALLOWED: 409,
  GITHUB_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
}

export type PublisherConsoleErrorDetails = {
  publisherConsoleCode: PublisherConsoleErrorCode
  jobId?: string
  existingJobId?: string
  state?: PublisherReleaseJobState
  [key: string]: unknown
}

export type PublisherReleaseChannel = 'stable' | 'beta' | 'rc' | 'dev'

export type PublisherSigningKeyPublicView = {
  keyId: string
  algorithm: 'Ed25519' | string
  /** SPKI PEM public half only. Private keys are never stored or returned. */
  publicKeyPem: string
  fingerprint: string
  state: 'ACTIVE' | 'ROTATED' | 'REVOKED' | string
  validFrom: string
  validUntil: string | null
  revokedAt: string | null
}

export type PublisherOnlineSigningIdentityPublicView = {
  identityId: string
  publisherId: string
  signingKeyId: string
  provider: 'VAULT_TRANSIT' | 'DISPOSABLE_TEST'
  purpose: 'PUBLISHER' | 'MODULA_FIRST_PARTY'
  state: 'ACTIVE' | 'SUSPENDED' | 'REVOKED'
  publicKeyFingerprint: string
  validFrom: string
  validUntil: string
  firstPartyAuthorized: boolean
}

export type PublisherModuleSummary = {
  moduleId: string
  publisherId: string
  name: string | null
  latestPublishedVersion: string | null
  latestVersion: string | null
  /** Repositories registered for this module (from registry releases or developer source connections), owner/name form. */
  sourceRepositories: string[]
  activeJobCount: number
  updatedAt: string | null
}

export type PublisherModuleVersion = {
  version: string
  /** 'registry' rows are real registry releases; 'job' rows are console jobs not yet in the registry as published. */
  origin: 'registry' | 'job'
  releaseId: string | null
  /** Registry release state (pendingReview | verified | published | superseded | quarantined | revoked ...) when origin = registry. */
  releaseState: string | null
  jobId: string | null
  jobState: PublisherReleaseJobState | null
  channel: PublisherReleaseChannel | null
  releaseTag: string | null
  sourceCommit: string | null
  publishedAt: string | null
  /** Legacy unsigned releases stay readable; they report signatureState 'unsigned'. */
  signatureState: 'verified' | 'unsigned' | 'invalid' | 'unknownKey' | 'revokedKey' | 'pending' | null
}

export type PublisherModuleDetail = PublisherModuleSummary & {
  description: string | null
  publisher: {publisherId: string; displayName: string | null; status: string | null; trustLevel: string | null}
  versions: PublisherModuleVersion[]
  signingKeys: PublisherSigningKeyPublicView[]
  recentJobs: PublisherReleaseJob[]
}

export type PublisherGithubSourceRelease = {
  repository: string
  releaseTag: string
  name: string | null
  draft: boolean
  prerelease: boolean
  publishedAt: string | null
  /** True when `<tag>.provenance.json` and a .tgz package asset are attached (metadata only; nothing downloaded). */
  hasProvenance: boolean
  packageAssetName: string | null
  /** False for drafts or releases without provenance/package assets. */
  valid: boolean
  invalidReason: string | null
  /** Existing console job for this tag, if any. */
  existingJobId: string | null
}

/** sourceRepository and releaseTag are the ONLY accepted body keys; any other key is rejected with INVALID_REQUEST. */
export type CreatePublisherReleaseJobRequest = {
  /** GitHub owner/name; must be one of the module's registered source repositories. */
  sourceRepository: string
  /** Existing immutable GitHub release tag. */
  releaseTag: string
}
/** Optional request header honoured on POST release-jobs: `Idempotency-Key`. */

export type PublishPublisherReleaseJobRequest = {
  /**
   * Required `true` when job.permissionDelta.reviewRequired is true. This is the
   * ONLY accepted body key; any other key (e.g. acknowledgePermissionExpansion)
   * is rejected with INVALID_REQUEST.
   */
  permissionChangeAcknowledged?: boolean
}

/** The server resolves the identity and key. keyId, bytes and digests are never accepted. */
export type RequestPublisherReleaseSigningRequest = {
  permissionChangeAcknowledged?: boolean
}

export type PublisherReleaseJobCheckStatus = 'passed' | 'failed' | 'pending' | 'skipped'

export type PublisherReleaseJobCheckId =
  | 'ownership'
  | 'source'
  | 'version_uniqueness'
  | 'package_digest'
  | 'manifest_digest'
  | 'frontend_digest'
  | 'signature'
  | 'compatibility'
  | 'permissions'
  | 'dependencies'
  | 'packaging'
  | 'policy'

export type PublisherReleaseJobCheck = {
  id: PublisherReleaseJobCheckId
  status: PublisherReleaseJobCheckStatus
  message?: string
  code?: PublisherConsoleErrorCode | string
}

export type PublisherReleaseJobPermission = {permission: string; reason: string | null; risk: string}

export type PublisherReleaseJobPreview = {
  identity: {moduleId: string; name: string | null; publisherId: string}
  version: string | null
  channel: PublisherReleaseChannel | null
  permissions: PublisherReleaseJobPermission[]
  digests: {package: string | null; manifest: string | null; productManifest: string | null; frontend: string | null}
  commit: string | null
  releaseTag: string
}

export type PublisherReleaseJobSignatureState =
  | 'pending'
  | 'missing'
  | 'verified'
  | 'invalid'
  | 'unknownKey'
  | 'revokedKey'

export type PublisherReleaseJobSignature = {
  state: PublisherReleaseJobSignatureState
  keyId?: string
  algorithm?: 'Ed25519'
  publicKeyFingerprint?: string | null
  statementSha256?: string
  verifiedAt?: string
  detail?: string
}

export type PublisherReleaseJobPermissionDelta = {
  baselineVersion: string | null
  added: PublisherReleaseJobPermission[]
  removed: PublisherReleaseJobPermission[]
  unchanged: PublisherReleaseJobPermission[]
  /** When true POST publish must carry permissionChangeAcknowledged: true. */
  reviewRequired: boolean
  reason: string | null
}

export type PublisherReleaseJobError = {code: PublisherConsoleErrorCode | string; message: string; details?: Record<string, unknown>}

export type PublisherReleaseJobLogLevel = 'info' | 'warn' | 'error'

export type PublisherReleaseJobLogEntry = {
  sequence: number
  at: string
  level: PublisherReleaseJobLogLevel
  step: string | null
  message: string
}

export type PublisherReleaseJobLogPage = {
  jobId: string
  entries: PublisherReleaseJobLogEntry[]
  /** Pass as ?after=<nextAfter> to page forward. */
  nextAfter: number | null
}

export type PublisherReleaseJobActions = {
  canValidate: boolean
  canRequestSigning: boolean
  canPublish: boolean
  canCancel: boolean
  canResume: boolean
}

export type PublisherReleaseSigningReceipt = {
  receiptId: string
  provider: 'VAULT_TRANSIT' | 'DISPOSABLE_TEST'
  identityId: string
  keyId: string
  publicKeyFingerprint: string
  providerKeyVersion: number | null
  approvalSha256: string
  statementSha256: string
  verifiedAt: string
}

export type PublisherReleaseSigningAuditEntry = {
  eventId: string
  eventType: string
  identityId: string | null
  approvalSha256: string | null
  statementSha256: string | null
  receipt: Record<string, unknown>
  details: Record<string, unknown>
  at: string
}

export type PublisherReleaseSigningStatus = {
  jobId: string
  state: PublisherReleaseJobState
  approval: {sha256: string; approvedAt: string} | null
  receipt: PublisherReleaseSigningReceipt | null
  auditHistory: PublisherReleaseSigningAuditEntry[]
}

export type PublisherReleaseJob = {
  jobId: string
  moduleId: string
  publisherId: string
  state: PublisherReleaseJobState
  sourceRepository: string
  releaseTag: string
  sourceCommit: string | null
  version: string | null
  channel: PublisherReleaseChannel | null
  artifactSha256: string | null
  /** Registry release id once imported (pendingReview/verified); never implies publication by itself. */
  releaseId: string | null
  preview: PublisherReleaseJobPreview
  signature: PublisherReleaseJobSignature
  validation: {passed: boolean; checks: PublisherReleaseJobCheck[]}
  permissionDelta: PublisherReleaseJobPermissionDelta | null
  permissionChangeAcknowledged: boolean
  signing: {
    approval: {sha256: string; approvedAt: string} | null
    requestId: string | null
    requestedByAccountId: string | null
    identityId: string | null
    startedAt: string | null
    signedAt: string | null
    receipt: PublisherReleaseSigningReceipt | null
  }
  error: PublisherReleaseJobError | null
  /** State the job was in when cancelled (null unless cancelled). */
  cancelledFromState: PublisherReleaseJobState | null
  /** Most recent log lines (newest last, up to 20) for review / failure screens; full log via /logs. */
  logSummary: PublisherReleaseJobLogEntry[]
  actions: PublisherReleaseJobActions
  createdByAccountId: string
  createdAt: string
  updatedAt: string
  publishedAt: string | null
  /** Optimistic concurrency revision; increments on every state change. */
  revision: number
}
