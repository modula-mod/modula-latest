import type {
  PolicyDecision,
  PolicyEvaluationInput,
  PolicyObligation,
  PolicyResourceReference,
} from '@modula/greenfield-contracts'
import {sql, type Kysely, type Transaction} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {uuidv7} from '../../lib/uuidv7.js'
import {AuditRepository} from '../audit/repository.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>

const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

type ResolvedPolicyInput = PolicyEvaluationInput & {
  actorAccountId?: string | null
  accountId?: string | null
  resource?: PolicyResourceReference
}

const ADMIN_ACTIONS = [
  'admin.',
  'diagnostics.',
  'system.diagnostics',
]

const AUDITED_ACTION_PREFIXES = [
  'account.export',
  'account.delete',
  'admin.',
  'ai.',
  'automation.',
  'connector.',
  'connection.',
  'dimon.',
  'export.',
  'module.',
  'note.export',
  'policy.',
]

const MODULE_ENABLED_ACTIONS = [
  'module.execute',
  'module.function',
  'module.record',
  'module.runtime',
  'module.view',
]

const HEALTHY_CONNECTION_STATES = new Set(['connected'])
const HEALTHY_CONNECTION_HEALTH = new Set(['healthy', 'not-checked'])
const PRIVATE_VISIBILITIES = new Set(['private', 'restricted', 'actor', 'account', 'system'])

export class GreenfieldPolicyEngine {
  constructor(private readonly db: Db) {}

  async evaluate(input: PolicyEvaluationInput): Promise<PolicyDecision> {
    const resolved = await this.resolveInput(input)

    const admin = this.evaluateAdmin(resolved)
    if (admin) return admin

    const dimon = this.evaluateDimon(resolved)
    if (dimon) return dimon

    const connection = await this.evaluateConnection(resolved)
    if (connection) return connection

    const module = await this.evaluateModule(resolved)
    if (module) return module

    const resource = await this.evaluateResourceVisibility(resolved)
    if (resource) return resource

    const ai = this.evaluateAiContext(resolved)
    if (ai) return ai

    return allow(this.auditRequiredFor(resolved))
  }

  async evaluateAndAudit(input: PolicyEvaluationInput): Promise<PolicyDecision> {
    const decision = await this.evaluate(input)
    if (decision.auditRequired || !decision.allowed) {
      await this.recordDecision(input, decision)
    }
    return decision
  }

  async assertAllowed(input: PolicyEvaluationInput): Promise<PolicyDecision> {
    const decision = await this.evaluateAndAudit(input)
    if (!decision.allowed) {
      throw Object.assign(new Error('Policy denied'), {
        code: 'FORBIDDEN',
        policyCode: decision.code,
        obligations: decision.obligations ?? [],
      })
    }
    return decision
  }

  async recordDecision(input: PolicyEvaluationInput, decision: PolicyDecision): Promise<void> {
    const now = new Date()
    const resolved = await this.resolveInput(input)
    const decisionId = uuidv7()
    await this.db
      .insertInto('greenfield_policy_decision_audit')
      .values({
        decision_id: decisionId,
        actor_id: input.actorId ?? null,
        account_id: resolved.accountId ?? resolved.actorAccountId ?? null,
        action: input.action,
        capability: input.capability ?? null,
        resource_type: input.resource?.type ?? null,
        resource_id: input.resource?.id ?? null,
        resource_owner_actor_id: resolved.resource?.ownerActorId ?? null,
        module_id: input.moduleId ?? null,
        connection_id: input.connectionId ?? null,
        allowed: decision.allowed,
        code: decision.code,
        obligations: jsonb(decision.obligations ?? []),
        audit_required: decision.auditRequired,
        risk_classification: input.riskClassification ?? null,
        request_id: input.requestContext?.requestId ?? null,
        correlation_id: input.requestContext?.correlationId ?? input.requestContext?.requestId ?? null,
        context: jsonb(sanitisePolicyContext({
          workspaceId: input.workspaceId,
          teamId: input.teamId,
          currentState: input.currentState,
          ipClassification: input.requestContext?.ipClassification,
          userAgentClassification: input.requestContext?.userAgentClassification,
        })),
        created_at: now,
      })
      .execute()

    if (decision.auditRequired || !decision.allowed) {
      await new AuditRepository(this.db).append(
        'policy.decision.evaluated',
        {
          decisionId,
          action: input.action,
          capability: input.capability,
          code: decision.code,
          obligations: decision.obligations ?? [],
          resource: input.resource,
        },
        {type: input.resource?.type ?? 'policy', id: input.resource?.id ?? decisionId, actorId: input.actorId ?? null},
        {
          accountId: resolved.accountId ?? resolved.actorAccountId ?? null,
          result: decision.allowed ? 'succeeded' : 'denied',
          requestId: input.requestContext?.requestId ?? null,
          correlationId: input.requestContext?.correlationId ?? input.requestContext?.requestId ?? null,
          ipClassification: input.requestContext?.ipClassification,
          userAgentClassification: input.requestContext?.userAgentClassification,
        },
      )
    }
  }

  private async resolveInput(input: PolicyEvaluationInput): Promise<ResolvedPolicyInput> {
    const actorAccountId = input.actorId ? await this.accountIdForActor(input.actorId) : null
    const resource = await this.resolveResource(input.resource)
    return {
      ...input,
      accountId: input.accountId ?? actorAccountId ?? null,
      actorAccountId,
      resource,
    }
  }

  private evaluateAdmin(input: ResolvedPolicyInput): PolicyDecision | null {
    if (!ADMIN_ACTIONS.some(prefix => input.action.startsWith(prefix) || input.action === prefix)) return null
    if (input.capability === 'admin:ops' || input.capability === 'admin:moderation') {
      return allow(true)
    }
    return deny('ADMIN_ROLE_REQUIRED', ['require-admin-role'], true)
  }

  private evaluateDimon(input: ResolvedPolicyInput): PolicyDecision | null {
    if (!input.action.startsWith('dimon.')) return null
    if (input.action.startsWith('dimon.transaction') && input.currentState !== 'confirmation-confirmed') {
      return deny('TRANSACTION_CONFIRMATION_REQUIRED', ['require-confirmation'], true)
    }
    return allow(true)
  }

  private async evaluateConnection(input: ResolvedPolicyInput): Promise<PolicyDecision | null> {
    if (!input.connectionId && input.resource?.type !== 'connection') return null
    const connectionId = input.connectionId ?? input.resource?.id
    const connection = connectionId
      ? await this.db
        .selectFrom('greenfield_connections')
        .select(['account_id', 'state', 'enabled', 'health_status'])
        .where('connection_id', '=', connectionId)
        .executeTakeFirst()
      : undefined

    const accountId = input.accountId ?? input.actorAccountId ?? null
    if (connection && accountId && connection.account_id !== accountId) {
      return deny('RESOURCE_NOT_VISIBLE', ['exclude-private-content'], true)
    }

    if (
      input.action === 'connection.refresh' ||
      input.action === 'connection.disconnect' ||
      input.action === 'connection.enable' ||
      input.action === 'connection.disable' ||
      input.action === 'connection.revoke'
    ) {
      return allow(true)
    }

    const state = connection?.state ?? input.currentState
    const enabled = connection?.enabled ?? (input.currentState !== 'disabled')
    const health = connection?.health_status ?? 'healthy'
    if (!enabled || !HEALTHY_CONNECTION_STATES.has(String(state)) || !HEALTHY_CONNECTION_HEALTH.has(String(health))) {
      return deny('CONNECTION_NOT_HEALTHY', ['require-connection-healthy'], true)
    }
    return allow(this.auditRequiredFor(input))
  }

  private async evaluateModule(input: ResolvedPolicyInput): Promise<PolicyDecision | null> {
    if (!input.moduleId && input.resource?.type !== 'module' && !input.action.startsWith('module.')) return null
    const moduleId = input.moduleId ?? input.resource?.id
    const requiresEnabled = MODULE_ENABLED_ACTIONS.some(prefix => input.action.startsWith(prefix))
    const accountId = input.accountId ?? input.actorAccountId ?? null
    let installation: {installation_id: string; status: string} | undefined

    if (moduleId && accountId) {
      installation = await this.db
        .selectFrom('greenfield_extension_installations')
        .innerJoin(
          'greenfield_extension_versions',
          'greenfield_extension_versions.extension_version_id',
          'greenfield_extension_installations.extension_version_id',
        )
        .innerJoin('greenfield_extensions', 'greenfield_extensions.extension_id', 'greenfield_extension_versions.extension_id')
        .select(['greenfield_extension_installations.installation_id', 'greenfield_extension_installations.status'])
        .where('greenfield_extension_installations.account_id', '=', accountId)
        .where(({eb, or}) =>
          or([
            eb('greenfield_extension_installations.installation_id', '=', moduleId),
            eb('greenfield_extensions.slug', '=', moduleId),
            eb('greenfield_extensions.extension_id', '=', moduleId),
          ]),
        )
        .executeTakeFirst()
    }

    const moduleState = installation?.status ?? input.currentState
    if (requiresEnabled && moduleState !== 'active' && moduleState !== 'enabled') {
      return deny('MODULE_NOT_ENABLED', ['require-module-enabled'], true)
    }

    if (input.capability && installation) {
      const granted = await this.db
        .selectFrom('greenfield_extension_capabilities')
        .select('capability_id')
        .where('installation_id', '=', installation.installation_id)
        .where('capability', '=', input.capability)
        .where('revoked_at', 'is', null)
        .executeTakeFirst()
      if (!granted) return deny('MODULE_PERMISSION_MISSING', ['redact-fields'], true)
    }

    return allow(this.auditRequiredFor(input))
  }

  private async evaluateResourceVisibility(input: ResolvedPolicyInput): Promise<PolicyDecision | null> {
    const resource = input.resource
    if (!resource) return null
    const visibility = resource.visibility ?? 'private'
    const ownerActorId = resource.ownerActorId ?? null
    const ownerAccountId = resource.ownerAccountId ?? (ownerActorId ? await this.accountIdForActor(ownerActorId) : null)
    const actorId = input.actorId ?? null
    const accountId = input.accountId ?? input.actorAccountId ?? null

    if (ownerActorId && actorId && ownerActorId === actorId) return allow(this.auditRequiredFor(input))
    if (ownerAccountId && accountId && ownerAccountId === accountId) return allow(this.auditRequiredFor(input))
    if (ownerActorId && actorId && await this.isBlockedEitherWay(actorId, ownerActorId)) {
      return deny('RESOURCE_NOT_VISIBLE', ['exclude-private-content'], this.auditRequiredFor(input))
    }
    if (visibility === 'public') return allow(this.auditRequiredFor(input))
    if (!actorId) return deny(aiAction(input) ? 'AI_CONTEXT_NOT_ALLOWED' : 'RESOURCE_NOT_VISIBLE', ['exclude-private-content'], this.auditRequiredFor(input))

    if (visibility === 'followers' && ownerActorId) {
      const follows = await this.db
        .selectFrom('follows')
        .select('id')
        .where('follower_actor_id', '=', actorId)
        .where('followed_actor_id', '=', ownerActorId)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      if (follows) return allow(this.auditRequiredFor(input))
    }

    if (aiAction(input) && PRIVATE_VISIBILITIES.has(visibility)) {
      return deny('AI_CONTEXT_NOT_ALLOWED', ['exclude-private-content', 'require-AI-consent'], true)
    }

    return deny('RESOURCE_NOT_VISIBLE', ['exclude-private-content'], this.auditRequiredFor(input))
  }

  private evaluateAiContext(input: ResolvedPolicyInput): PolicyDecision | null {
    if (!aiAction(input)) return null
    if (input.currentState === 'AI-consent-missing' || input.riskClassification === 'restricted') {
      return deny('AI_CONTEXT_NOT_ALLOWED', ['exclude-private-content', 'require-AI-consent'], true)
    }
    return allow(true)
  }

  private auditRequiredFor(input: ResolvedPolicyInput): boolean {
    if (input.riskClassification === 'sensitive' || input.riskClassification === 'restricted') return true
    return AUDITED_ACTION_PREFIXES.some(prefix => input.action.startsWith(prefix))
  }

  private async resolveResource(resource?: PolicyResourceReference): Promise<PolicyResourceReference | undefined> {
    if (!resource?.id) return resource
    if (resource.type === 'post') {
      const post = await this.db
        .selectFrom('posts')
        .select(['author_actor_id', 'audience'])
        .where('id', '=', resource.id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      if (!post) return {...resource, visibility: resource.visibility ?? 'private'}
      return {...resource, ownerActorId: resource.ownerActorId ?? post.author_actor_id, visibility: resource.visibility ?? post.audience}
    }
    if (resource.type === 'comment') {
      const comment = await this.db
        .selectFrom('greenfield_comments')
        .innerJoin('posts', 'posts.id', 'greenfield_comments.post_id')
        .select(['greenfield_comments.author_actor_id', 'posts.author_actor_id as post_author_actor_id', 'posts.audience'])
        .where('greenfield_comments.comment_id', '=', resource.id)
        .where('greenfield_comments.deleted_at', 'is', null)
        .executeTakeFirst()
      if (!comment) return {...resource, visibility: resource.visibility ?? 'private'}
      return {
        ...resource,
        ownerActorId: resource.ownerActorId ?? comment.author_actor_id,
        visibility: resource.visibility ?? comment.audience,
      }
    }
    if (resource.type === 'profile') {
      const profile = await this.db
        .selectFrom('profiles')
        .select(['actor_id', 'visibility'])
        .where(({eb, or}) => or([eb('id', '=', resource.id!), eb('handle', '=', resource.id!)]))
        .where('deleted_at', 'is', null)
        .executeTakeFirst()
      if (!profile) return {...resource, visibility: resource.visibility ?? 'private'}
      return {...resource, ownerActorId: resource.ownerActorId ?? profile.actor_id, visibility: resource.visibility ?? profile.visibility}
    }
    if (resource.type === 'greenfield_record' || resource.type === 'note') {
      const record = await this.db
        .selectFrom('greenfield_records')
        .innerJoin('greenfield_repositories', 'greenfield_repositories.repository_id', 'greenfield_records.repository_id')
        .select(['greenfield_repositories.account_id', 'greenfield_records.visibility'])
        .where('greenfield_records.record_id', '=', resource.id)
        .where('greenfield_records.deleted_at', 'is', null)
        .executeTakeFirst()
      if (!record) return {...resource, visibility: resource.visibility ?? 'private'}
      return {...resource, ownerAccountId: resource.ownerAccountId ?? record.account_id, visibility: resource.visibility ?? record.visibility}
    }
    return resource
  }

  private async accountIdForActor(actorId: string): Promise<string | null> {
    const row = await this.db
      .selectFrom('actors')
      .select('account_id')
      .where('id', '=', actorId)
      .executeTakeFirst()
    return row?.account_id ?? null
  }

  private async isBlockedEitherWay(actorId: string, otherActorId: string): Promise<boolean> {
    const blocked = await this.db
      .selectFrom('blocks')
      .select('id')
      .where('deleted_at', 'is', null)
      .where(({eb, or, and}) =>
        or([
          and([eb('blocker_actor_id', '=', actorId), eb('blocked_actor_id', '=', otherActorId)]),
          and([eb('blocker_actor_id', '=', otherActorId), eb('blocked_actor_id', '=', actorId)]),
        ]),
      )
      .executeTakeFirst()
    return Boolean(blocked)
  }
}

export function policyErrorResponse(decision: PolicyDecision): {code: string; obligations: PolicyObligation[]} {
  return {
    code: decision.code,
    obligations: decision.obligations ?? [],
  }
}

function allow(auditRequired: boolean): PolicyDecision {
  return {allowed: true, code: 'ALLOWED', auditRequired}
}

function deny(
  code: Exclude<PolicyDecision['code'], 'ALLOWED'>,
  obligations: PolicyObligation[],
  _auditRequired: boolean,
): PolicyDecision {
  return {allowed: false, code, obligations, auditRequired: true}
}

function aiAction(input: PolicyEvaluationInput): boolean {
  return input.action.startsWith('ai.') || input.action.includes('.ai.')
}

function sanitisePolicyContext(input: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined))
}
