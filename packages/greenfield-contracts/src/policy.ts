export type PolicyObligation =
  | 'require-confirmation'
  | 'redact-fields'
  | 'limit-results'
  | 'exclude-private-content'
  | 'require-reauthentication'
  | 'require-admin-role'
  | 'require-module-enabled'
  | 'require-connection-healthy'
  | 'require-AI-consent'

export type PolicyDenialCode =
  | 'RESOURCE_NOT_VISIBLE'
  | 'MODULE_NOT_ENABLED'
  | 'MODULE_PERMISSION_MISSING'
  | 'AI_CONTEXT_NOT_ALLOWED'
  | 'CONNECTION_NOT_HEALTHY'
  | 'REAUTHENTICATION_REQUIRED'
  | 'TRANSACTION_CONFIRMATION_REQUIRED'
  | 'ADMIN_ROLE_REQUIRED'
  | 'FORBIDDEN'

export type PolicyDecisionCode = 'ALLOWED' | PolicyDenialCode

export interface PolicyDecision {
  allowed: boolean
  code: PolicyDecisionCode
  reason?: string
  obligations?: PolicyObligation[]
  auditRequired: boolean
}

export interface PolicyResourceReference {
  type: string
  id?: string
  ownerActorId?: string
  ownerAccountId?: string
  visibility?: string
}

export interface PolicyRequestContext {
  requestId?: string
  correlationId?: string
  ipClassification?: 'unknown' | 'local' | 'private' | 'public' | 'trusted-proxy'
  userAgentClassification?: 'unknown' | 'browser' | 'mobile' | 'service' | 'bot' | 'cli'
}

export interface PolicyEvaluationInput {
  actorId?: string | null
  accountId?: string | null
  resource?: PolicyResourceReference
  action: string
  capability?: string
  moduleId?: string
  connectionId?: string
  workspaceId?: string
  teamId?: string
  riskClassification?: string
  currentState?: string
  requestContext?: PolicyRequestContext
}
