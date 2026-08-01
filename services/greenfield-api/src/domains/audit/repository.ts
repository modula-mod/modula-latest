import {randomUUID} from 'node:crypto'
import {sql, type Kysely, type Transaction} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>
type AuditResult = 'succeeded' | 'denied' | 'failed' | 'cancelled'
const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export type AuditAppendContext = {
  accountId?: string | null
  result?: AuditResult
  requestId?: string | null
  correlationId?: string | null
  ipClassification?: Database['audit_events']['ip_classification']
  userAgentClassification?: Database['audit_events']['user_agent_classification']
}

export class AuditRepository {
  constructor(private readonly db: Db) {}

  async append(
    eventType: string,
    metadata: Record<string, unknown> = {},
    resource?: {type?: string; id?: string; actorId?: string | null},
    context: AuditAppendContext = {},
  ) {
    const auditId = `audit-${randomUUID()}`
    await this.db
      .insertInto('audit_events')
      .values({
        id: auditId,
        audit_id: auditId,
        event_type: eventType,
        account_id: context.accountId ?? null,
        actor_id: resource?.actorId ?? null,
        action: eventType,
        resource_type: resource?.type ?? null,
        resource_id: resource?.id ?? null,
        result: context.result ?? 'succeeded',
        request_id: context.requestId ?? null,
        correlation_id: context.correlationId ?? context.requestId ?? null,
        ip_classification: context.ipClassification ?? 'unknown',
        user_agent_classification: context.userAgentClassification ?? 'unknown',
        metadata_schema_version: 1,
        metadata: jsonb(sanitizeAuditMetadata(metadata)),
        created_at: new Date(),
      })
      .execute()
  }
}

const SECRET_KEY_PATTERN = /(password|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|private[_-]?key|secret|pkce[_-]?verifier|credential)/i
const PRIVATE_CONTENT_KEY_PATTERN = /(note|document|content|prompt|plain[_-]?text|body|text)/i

export function sanitizeAuditMetadata(input: unknown, depth = 0): unknown {
  if (input === null || input === undefined) return input
  if (depth > 6) return '[redacted:depth-limit]'
  if (Array.isArray(input)) return input.slice(0, 50).map(item => sanitizeAuditMetadata(item, depth + 1))
  if (typeof input !== 'object') {
    if (typeof input === 'string' && input.length > 500) return `${input.slice(0, 120)}...[truncated]`
    return input
  }

  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      output[key] = '[redacted:secret]'
      continue
    }
    if (PRIVATE_CONTENT_KEY_PATTERN.test(key) && typeof value === 'string' && value.length > 160) {
      output[key] = '[redacted:private-content]'
      continue
    }
    output[key] = sanitizeAuditMetadata(value, depth + 1)
  }
  return output
}
