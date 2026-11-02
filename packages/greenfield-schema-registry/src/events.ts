export type EventVisibility = 'public' | 'account' | 'actor' | 'internal' | 'restricted'
export type EventDataClassification = 'public' | 'internal' | 'private' | 'sensitive' | 'restricted'
export type EventCompatibilityPolicy = 'backward-compatible-additive' | 'strict-versioned' | 'append-only'
export type EventReplayPolicy = 'safe-idempotent' | 'guarded-idempotent' | 'manual-approval-required' | 'not-replayable'

export type GreenfieldEventSchemaDefinition = {
  eventType: string
  owner: string
  version: string
  aggregateType: string
  jsonSchema: Record<string, unknown>
  compatibilityPolicy: EventCompatibilityPolicy
  retentionPolicy: string
  dataClassification: EventDataClassification
  permittedSubscribers: readonly string[]
  replayPolicy: EventReplayPolicy
}

const objectSchema = (description: string): Record<string, unknown> => ({
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  description,
  additionalProperties: true,
})

const subscribersFor = (classification: EventDataClassification): readonly string[] => {
  if (classification === 'restricted') return ['greenfield.audit', 'greenfield.policy', 'greenfield.diagnostics']
  if (classification === 'sensitive') return ['greenfield.audit', 'greenfield.policy', 'greenfield.notifications']
  if (classification === 'private') return ['greenfield.audit', 'greenfield.search.private', 'greenfield.notifications', 'greenfield.automation']
  return ['greenfield.audit', 'greenfield.search', 'greenfield.notifications', 'greenfield.automation', 'greenfield.analytics']
}

const event = (
  eventType: string,
  owner: string,
  aggregateType: string,
  dataClassification: EventDataClassification = 'internal',
  replayPolicy: EventReplayPolicy = 'guarded-idempotent',
  retentionPolicy = 'standard-platform-retention',
): GreenfieldEventSchemaDefinition => ({
  eventType,
  owner,
  version: '1.0.0',
  aggregateType,
  jsonSchema: objectSchema(`${eventType} payload`),
  compatibilityPolicy: 'backward-compatible-additive',
  retentionPolicy,
  dataClassification,
  permittedSubscribers: subscribersFor(dataClassification),
  replayPolicy,
})

const searchOperationalEvent = (
  eventType: string,
  aggregateType: string,
  replayPolicy: EventReplayPolicy = 'not-replayable',
): GreenfieldEventSchemaDefinition => ({
  ...event(eventType, 'search', aggregateType, 'internal', replayPolicy, 'search-ops-retention'),
  permittedSubscribers: ['greenfield.audit', 'greenfield.diagnostics'],
})

export const greenfieldEventSchemas: readonly GreenfieldEventSchemaDefinition[] = [
  event('account.created', 'identity', 'account', 'private'),
  event('account.updated', 'identity', 'account', 'private'),
  event('account.deactivated', 'identity', 'account', 'sensitive', 'manual-approval-required'),
  event('account.deletion-requested', 'identity', 'account', 'sensitive', 'manual-approval-required', 'account-deletion-retention'),
  event('profile.updated', 'identity', 'profile', 'internal'),
  event('profile.visibility-changed', 'identity', 'profile', 'private'),
  event('session.created', 'identity', 'session', 'sensitive', 'not-replayable', 'security-retention'),
  event('session.revoked', 'identity', 'session', 'sensitive', 'not-replayable', 'security-retention'),

  event('post.created', 'social', 'post', 'internal'),
  event('post.updated', 'social', 'post', 'internal'),
  event('post.deleted', 'social', 'post', 'internal', 'manual-approval-required'),
  event('post.visibility-changed', 'social', 'post', 'private', 'manual-approval-required'),
  event('post.saved', 'social', 'postSave', 'private'),
  event('post.unsaved', 'social', 'postSave', 'private'),
  event('comment.created', 'social', 'comment', 'internal'),
  event('comment.updated', 'social', 'comment', 'internal'),
  event('comment.deleted', 'social', 'comment', 'internal', 'manual-approval-required'),
  event('reaction.created', 'social', 'reaction', 'internal', 'safe-idempotent'),
  event('reaction.removed', 'social', 'reaction', 'internal', 'safe-idempotent'),
  event('follow.created', 'social', 'follow', 'internal', 'safe-idempotent'),
  event('follow.removed', 'social', 'follow', 'internal', 'safe-idempotent'),
  event('message.story-replied', 'messaging', 'conversation-message', 'private', 'safe-idempotent', 'messaging-retention'),

  event('community.created', 'communities', 'community', 'internal'),
  event('community.updated', 'communities', 'community', 'internal'),
  event('community.member-joined', 'communities', 'communityMembership', 'private', 'safe-idempotent', 'standard-social-retention'),
  event('community.member-left', 'communities', 'communityMembership', 'private', 'safe-idempotent', 'standard-social-retention'),
  event('community.post-created', 'communities', 'communityPost', 'internal'),
  event('community.poll-created', 'communities', 'communityPoll', 'internal'),
  event('community.poll-voted', 'communities', 'communityPollVote', 'private', 'safe-idempotent', 'standard-social-retention'),
  event('community.event-created', 'communities', 'communityEvent', 'internal'),
  event('community.event-responded', 'communities', 'communityEventResponse', 'private', 'safe-idempotent', 'standard-social-retention'),

  event('module.discovered', 'modules', 'moduleRelease', 'internal'),
  event('module.install-requested', 'modules', 'moduleInstallation', 'private', 'manual-approval-required'),
  event('module.installed', 'modules', 'moduleInstallation', 'internal'),
  event('module.enabled', 'modules', 'moduleInstallation', 'internal'),
  event('module.disabled', 'modules', 'moduleInstallation', 'internal'),
  event('module.update-available', 'modules', 'moduleRelease', 'internal'),
  event('module.update-started', 'modules', 'moduleInstallation', 'internal'),
  event('module.updated', 'modules', 'moduleInstallation', 'internal'),
  event('module.update-failed', 'modules', 'moduleInstallation', 'internal'),
  event('module.quarantined', 'modules', 'moduleRelease', 'sensitive', 'manual-approval-required'),
  event('module.uninstalled', 'modules', 'moduleInstallation', 'private', 'manual-approval-required'),
  event('module.health-changed', 'modules', 'moduleInstallation', 'internal'),
  event('module.release.imported', 'modules', 'moduleRelease', 'internal'),
  event('module.release.published', 'modules', 'moduleRelease', 'internal'),
  event('module.release.quarantined', 'modules', 'moduleRelease', 'sensitive', 'manual-approval-required'),
  event('module.release.revoked', 'modules', 'moduleRelease', 'sensitive', 'manual-approval-required'),
  event('module.record.changed', 'modules', 'moduleRecord', 'private'),

  searchOperationalEvent('search.document-indexed', 'searchDocument'),
  searchOperationalEvent('search.document-deleted', 'searchDocument'),
  searchOperationalEvent('search.projection-failed', 'searchProjectionFailure'),
  searchOperationalEvent('search.reindex-requested', 'searchReindex', 'manual-approval-required'),
  searchOperationalEvent('search.reindex-completed', 'searchReindex'),
  searchOperationalEvent('search.reindex-failed', 'searchReindex'),

  event('note.created', 'notes', 'note', 'private'),
  event('note.updated', 'notes', 'note', 'private'),
  event('note.archived', 'notes', 'note', 'private'),
  event('note.deleted', 'notes', 'note', 'private', 'manual-approval-required'),
  event('note.restored', 'notes', 'note', 'private', 'manual-approval-required'),
  event('note.linked', 'notes', 'noteLink', 'private'),
  event('note.exported', 'notes', 'noteExport', 'sensitive', 'manual-approval-required'),
  event('note.ai-processed', 'notes', 'noteAiArtifact', 'sensitive', 'manual-approval-required'),

  event('vault-notes.note.created', 'vault-notes', 'note', 'private'),
  event('vault-notes.note.updated', 'vault-notes', 'note', 'private'),
  event('vault-notes.note.archived', 'vault-notes', 'note', 'private'),
  event('vault-notes.note.unarchived', 'vault-notes', 'note', 'private'),
  event('vault-notes.note.deleted', 'vault-notes', 'note', 'private', 'manual-approval-required'),
  event('vault-notes.note.restored', 'vault-notes', 'note', 'private', 'manual-approval-required'),
  event('vault-notes.note.permanently-deleted', 'vault-notes', 'note', 'sensitive', 'manual-approval-required'),
  event('vault-notes.note.duplicated', 'vault-notes', 'note', 'private'),
  event('vault-notes.note.exported', 'vault-notes', 'noteExport', 'sensitive', 'manual-approval-required', 'module-export-retention'),
  event('vault-notes.folder.created', 'vault-notes', 'vault-folder', 'private'),
  event('vault-notes.folder.updated', 'vault-notes', 'vault-folder', 'private'),
  event('vault-notes.folder.deleted', 'vault-notes', 'vault-folder', 'private', 'manual-approval-required'),

  event('ai.requested', 'ai', 'aiRequest', 'sensitive', 'manual-approval-required', 'ai-usage-retention'),
  event('ai.started', 'ai', 'aiRequest', 'sensitive', 'not-replayable', 'ai-usage-retention'),
  event('ai.completed', 'ai', 'aiRequest', 'sensitive', 'guarded-idempotent', 'ai-usage-retention'),
  event('ai.failed', 'ai', 'aiRequest', 'sensitive', 'guarded-idempotent', 'ai-usage-retention'),
  event('ai.cancelled', 'ai', 'aiRequest', 'sensitive', 'not-replayable', 'ai-usage-retention'),
  event('ai.model.enabled', 'ai', 'aiModel', 'sensitive', 'manual-approval-required', 'ai-registry-retention'),
  event('ai.model.disabled', 'ai', 'aiModel', 'sensitive', 'manual-approval-required', 'ai-registry-retention'),
  event('ai.prompt.published', 'ai', 'aiPrompt', 'sensitive', 'manual-approval-required', 'ai-prompt-retention'),
  event('ai.stream.progress', 'ai', 'aiStream', 'sensitive', 'not-replayable', 'ai-usage-retention'),
  event('ai.tool-requested', 'ai', 'aiToolRun', 'restricted', 'manual-approval-required', 'ai-tool-retention'),
  event('ai.tool-confirmed', 'ai', 'aiToolRun', 'restricted', 'not-replayable', 'ai-tool-retention'),
  event('ai.tool-completed', 'ai', 'aiToolRun', 'restricted', 'guarded-idempotent', 'ai-tool-retention'),
  event('ai.memory-created', 'ai', 'aiMemory', 'sensitive', 'manual-approval-required', 'ai-memory-retention'),
  event('ai.memory-deleted', 'ai', 'aiMemory', 'sensitive', 'not-replayable', 'ai-memory-retention'),

  event('connection.created', 'connectors', 'connection', 'sensitive'),
  event('connection.authorised', 'connectors', 'connection', 'restricted', 'not-replayable', 'connector-security-retention'),
  event('connection.degraded', 'connectors', 'connection', 'sensitive'),
  event('connection.refreshed', 'connectors', 'connection', 'restricted', 'not-replayable', 'connector-security-retention'),
  event('connection.revoked', 'connectors', 'connection', 'restricted', 'not-replayable', 'connector-security-retention'),
  event('connection.disconnected', 'connectors', 'connection', 'sensitive', 'manual-approval-required'),
  event('connector.sync-started', 'connectors', 'connectorSync', 'sensitive', 'not-replayable', 'connector-sync-retention'),
  event('connector.sync-completed', 'connectors', 'connectorSync', 'sensitive', 'guarded-idempotent', 'connector-sync-retention'),
  event('connector.sync-failed', 'connectors', 'connectorSync', 'sensitive', 'guarded-idempotent', 'connector-sync-retention'),
  event('connector.webhook-received', 'connectors', 'connectorWebhook', 'restricted', 'not-replayable', 'connector-webhook-retention'),

  event('automation.created', 'automation', 'automation', 'private'),
  event('automation.enabled', 'automation', 'automation', 'private', 'manual-approval-required'),
  event('automation.triggered', 'automation', 'automationExecution', 'private', 'not-replayable', 'automation-run-retention'),
  event('automation.execution-started', 'automation', 'automationExecution', 'private', 'not-replayable', 'automation-run-retention'),
  event('automation.execution-completed', 'automation', 'automationExecution', 'private', 'guarded-idempotent', 'automation-run-retention'),
  event('automation.execution-failed', 'automation', 'automationExecution', 'private', 'guarded-idempotent', 'automation-run-retention'),
  event('automation.disabled', 'automation', 'automation', 'private', 'manual-approval-required'),

  event('dimon.transaction-prepared', 'dimon', 'dimonTransaction', 'restricted', 'manual-approval-required', 'dimon-retention'),
  event('dimon.transaction-submitted', 'dimon', 'dimonTransaction', 'restricted', 'not-replayable', 'dimon-retention'),
  event('dimon.transaction-rejected', 'dimon', 'dimonTransaction', 'restricted', 'guarded-idempotent', 'dimon-retention'),
  event('dimon.transaction-confirmed', 'dimon', 'dimonTransaction', 'restricted', 'guarded-idempotent', 'dimon-retention'),
  event('dimon.block-created', 'dimon', 'dimonBlock', 'public', 'safe-idempotent', 'dimon-retention'),
  event('dimon.validator-health-changed', 'dimon', 'dimonValidator', 'internal', 'safe-idempotent', 'dimon-retention'),
  event('dimon.anchor-created', 'dimon', 'dimonAnchor', 'public', 'safe-idempotent', 'dimon-retention'),
]

export function getEventSchema(eventType: string, version = '1.0.0'): GreenfieldEventSchemaDefinition | undefined {
  return greenfieldEventSchemas.find(schema => schema.eventType === eventType && schema.version === version)
}

export function listEventSchemas(): readonly GreenfieldEventSchemaDefinition[] {
  return greenfieldEventSchemas
}

export function eventSchemaExists(eventType: string, version = '1.0.0'): boolean {
  return Boolean(getEventSchema(eventType, version))
}
