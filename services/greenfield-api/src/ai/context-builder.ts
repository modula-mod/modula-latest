import type {
  GreenfieldAIContextBuildResult,
  GreenfieldAIContextFragment,
  GreenfieldAIContextResourceReference,
} from '@modula/greenfield-contracts'
import type {ModulaDb} from '../database/client.js'
import {GreenfieldPolicyEngine} from '../domains/policy/index.js'

const CLASSIFICATION_PERMISSIONS: Record<GreenfieldAIContextFragment['classification'], string> = {
  public: 'ai.context.public',
  internal: 'ai.context.public',
  private: 'ai.context.private',
  sensitive: 'ai.context.private',
  restricted: 'ai.context.restricted',
}

export class GreenfieldAIContextBuilder {
  private readonly policies: GreenfieldPolicyEngine

  constructor(db: ModulaDb) {
    this.policies = new GreenfieldPolicyEngine(db)
  }

  async build(input: {
    accountId: string
    actorId?: string | null
    moduleId: string
    resources?: GreenfieldAIContextResourceReference[]
    fragments?: GreenfieldAIContextFragment[]
    transient?: Record<string, unknown>
    conversationHistoryRef?: string
    systemInstructionRefs?: string[]
    grantedPermissions?: string[]
    requestId: string
    correlationId: string
  }): Promise<GreenfieldAIContextBuildResult> {
    const allowedResources: GreenfieldAIContextResourceReference[] = []
    const redactedResources: Array<GreenfieldAIContextResourceReference & {reason: string}> = []
    const allowedFragments: GreenfieldAIContextFragment[] = []
    const redactedFragments: Array<Pick<GreenfieldAIContextFragment, 'sourceType' | 'sourceId' | 'classification'> & {reason: string}> = []
    const granted = new Set(input.grantedPermissions ?? [])

    for (const resource of input.resources ?? []) {
      const decision = await this.policies.evaluateAndAudit({
        actorId: input.actorId ?? null,
        accountId: input.accountId,
        moduleId: input.moduleId,
        action: 'ai.context.build',
        resource,
        requestContext: {
          requestId: input.requestId,
          correlationId: input.correlationId,
        },
      })
      if (decision.allowed) {
        allowedResources.push(resource)
      } else {
        redactedResources.push({...resource, reason: decision.code})
      }
    }

    for (const fragment of input.fragments ?? []) {
      const requiredPermission = CLASSIFICATION_PERMISSIONS[fragment.classification]
      const fragmentPermissions = Array.from(new Set([requiredPermission, ...fragment.permissions]))
      const missing = fragmentPermissions.find(permission => !granted.has(permission))
      if (missing) {
        redactedFragments.push({
          sourceType: fragment.sourceType,
          sourceId: fragment.sourceId,
          classification: fragment.classification,
          reason: `missing:${missing}`,
        })
        continue
      }
      if (fragment.classification === 'restricted' && !granted.has('ai.context.restricted')) {
        redactedFragments.push({
          sourceType: fragment.sourceType,
          sourceId: fragment.sourceId,
          classification: fragment.classification,
          reason: 'restricted-denied-by-default',
        })
        continue
      }
      const decision = await this.policies.evaluateAndAudit({
        actorId: input.actorId ?? null,
        accountId: input.accountId,
        moduleId: input.moduleId,
        action: 'ai.context.fragment',
        resource: {
          type: fragment.sourceType,
          id: fragment.sourceId ?? `${fragment.sourceType}:transient`,
          ownerAccountId: fragment.classification === 'public' ? undefined : input.accountId,
          visibility: fragment.classification === 'public' ? 'public' : fragment.classification,
        },
        requestContext: {
          requestId: input.requestId,
          correlationId: input.correlationId,
        },
      })
      if (!decision.allowed) {
        redactedFragments.push({
          sourceType: fragment.sourceType,
          sourceId: fragment.sourceId,
          classification: fragment.classification,
          reason: decision.code,
        })
        continue
      }
      allowedFragments.push({
        ...fragment,
        content: redactInlineSecrets(fragment.content),
        tokenEstimate: fragment.tokenEstimate ?? estimateTextUnits(fragment.content),
      })
    }

    return {
      allowedResources,
      redactedResources,
      allowedFragments,
      redactedFragments,
      tokenEstimate: allowedFragments.reduce((sum, fragment) => sum + (fragment.tokenEstimate ?? 0), 0),
      transientKeys: Object.keys(input.transient ?? {}).sort(),
      systemInstructionRefs: input.systemInstructionRefs ?? [],
      conversationHistoryRef: input.conversationHistoryRef,
    }
  }
}

function estimateTextUnits(value: string): number {
  return Math.ceil(Buffer.byteLength(value, 'utf8') / 4)
}

function redactInlineSecrets(value: string): string {
  return value
    .replace(/\b(sk-[A-Za-z0-9_-]{12,})\b/g, '[redacted-secret]')
    .replace(/\b(api[_-]?key|token|secret)\s*[:=]\s*\S+/gi, '$1=[redacted]')
}
