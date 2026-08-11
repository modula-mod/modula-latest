import {sql, type Kysely, type Transaction} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import type {AuthenticationMethodType, Database, SecurityEventSeverity} from '../../database/types.js'
import {uuidv7} from '../../lib/uuidv7.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>
const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export class SecurityEventService {
  constructor(private readonly db: Db) {}

  forDb(db: Db): SecurityEventService {
    return new SecurityEventService(db)
  }

  async record(input: {
    accountId: string
    sessionId?: string | null
    eventType: string
    methodType?: AuthenticationMethodType | null
    methodId?: string | null
    severity?: SecurityEventSeverity
    ipHash?: string | null
    userAgent?: string | null
    metadata?: Record<string, unknown>
    createdAt?: Date
  }): Promise<string> {
    const eventId = uuidv7()
    await this.db
      .insertInto('greenfield_security_events')
      .values({
        event_id: eventId,
        account_id: input.accountId,
        session_id: input.sessionId ?? null,
        event_type: input.eventType,
        method_type: input.methodType ?? null,
        method_id: input.methodId ?? null,
        severity: input.severity ?? 'notice',
        ip_hash: input.ipHash ?? null,
        user_agent: input.userAgent?.slice(0, 512) ?? null,
        metadata: jsonb(sanitizeSecurityEventMetadata(input.metadata ?? {})),
        created_at: input.createdAt ?? new Date(),
      })
      .execute()
    return eventId
  }
}

const SECRET_KEY_PATTERN = /(password|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|private[_-]?key|secret|credential|code|otp)/i

function sanitizeSecurityEventMetadata(input: unknown, depth = 0): unknown {
  if (input === null || input === undefined) return input
  if (depth > 6) return '[redacted:depth-limit]'
  if (Array.isArray(input)) return input.slice(0, 50).map(item => sanitizeSecurityEventMetadata(item, depth + 1))
  if (typeof input !== 'object') return input

  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    output[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted:secret]' : sanitizeSecurityEventMetadata(value, depth + 1)
  }
  return output
}
