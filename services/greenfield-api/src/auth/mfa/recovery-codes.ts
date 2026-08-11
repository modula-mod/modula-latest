import {sql, type Kysely, type Transaction} from 'kysely'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {uuidv7} from '../../lib/uuidv7.js'
import {authError} from '../errors.js'
import {CredentialRegistryService} from '../credentials/service.js'
import {SecurityEventService} from '../security-events/service.js'
import {generateHumanRecoveryCode, hashRecoveryCode, normalizeRecoveryCode} from './recovery-code-utils.js'

type Db = ModulaDb | Transaction<Database> | Kysely<Database>

const DEFAULT_RECOVERY_CODE_COUNT = 10
const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`

export type GeneratedRecoveryCodes = {
  setId: string
  codes: string[]
  remaining: number
  generatedAt: string
}

export class RecoveryCodeService {
  private readonly credentials: CredentialRegistryService
  private readonly securityEvents: SecurityEventService

  constructor(
    private readonly db: Db,
    private readonly config: Pick<AppConfig, 'sessionPepper'>,
    services: {credentials?: CredentialRegistryService; securityEvents?: SecurityEventService} = {},
  ) {
    this.credentials = services.credentials ?? new CredentialRegistryService(db)
    this.securityEvents = services.securityEvents ?? new SecurityEventService(db)
  }

  forDb(db: Db): RecoveryCodeService {
    return new RecoveryCodeService(db, this.config, {
      credentials: this.credentials.forDb(db),
      securityEvents: this.securityEvents.forDb(db),
    })
  }

  async regenerate(
    accountId: string,
    input: {sessionId?: string | null; reason?: string; createdAt?: Date} = {},
  ): Promise<GeneratedRecoveryCodes> {
    const now = input.createdAt ?? new Date()
    const methodId = await this.credentials.createRecoveryCodeMethod({
      accountId,
      state: 'active',
      verifiedAt: now,
      createdAt: now,
      metadata: {count: DEFAULT_RECOVERY_CODE_COUNT},
    })
    await this.invalidateActive(accountId, now)
    const setId = uuidv7()
    const codes = uniqueRecoveryCodes(DEFAULT_RECOVERY_CODE_COUNT)
    await this.db
      .insertInto('greenfield_recovery_code_sets')
      .values({
        set_id: setId,
        method_id: methodId,
        account_id: accountId,
        state: 'active',
        generated_at: now,
        invalidated_at: null,
        created_at: now,
      })
      .execute()
    await this.db
      .insertInto('greenfield_recovery_codes')
      .values(
        codes.map(code => ({
          code_id: uuidv7(),
          set_id: setId,
          account_id: accountId,
          code_hash: hashRecoveryCode(code, this.config.sessionPepper),
          used_at: null,
          created_at: now,
        })),
      )
      .execute()
    await this.securityEvents.record({
      accountId,
      sessionId: input.sessionId ?? null,
      eventType: 'recovery_codes.regenerated',
      methodType: 'recovery_code',
      methodId,
      severity: 'warning',
      metadata: {reason: input.reason ?? 'manual', count: DEFAULT_RECOVERY_CODE_COUNT},
      createdAt: now,
    })
    return {setId, codes, remaining: codes.length, generatedAt: now.toISOString()}
  }

  async consume(
    accountId: string,
    code: string,
    input: {sessionId?: string | null; ipHash?: string | null; userAgent?: string | null} = {},
  ): Promise<{consumed: true; methodId: string; remaining: number}> {
    const normalized = normalizeRecoveryCode(code)
    if (normalized.length < 16) throw authError('INVALID_CREDENTIALS')
    const now = new Date()
    return this.executeWrite(async db => {
      const row = await db
        .selectFrom('greenfield_recovery_codes')
        .innerJoin('greenfield_recovery_code_sets', 'greenfield_recovery_code_sets.set_id', 'greenfield_recovery_codes.set_id')
        .select([
          'greenfield_recovery_codes.code_id',
          'greenfield_recovery_codes.set_id',
          'greenfield_recovery_codes.used_at',
          'greenfield_recovery_code_sets.method_id',
          'greenfield_recovery_code_sets.state',
        ])
        .where('greenfield_recovery_codes.account_id', '=', accountId)
        .where('greenfield_recovery_codes.code_hash', '=', hashRecoveryCode(normalized, this.config.sessionPepper))
        .forUpdate()
        .executeTakeFirst()
      if (!row || row.state !== 'active' || row.used_at) throw authError('INVALID_CREDENTIALS')
      await db
        .updateTable('greenfield_recovery_codes')
        .set({used_at: now})
        .where('code_id', '=', row.code_id)
        .where('used_at', 'is', null)
        .execute()
      const remainingRow = await db
        .selectFrom('greenfield_recovery_codes')
        .select(({fn}) => fn.countAll<number>().as('remaining'))
        .where('set_id', '=', row.set_id)
        .where('used_at', 'is', null)
        .executeTakeFirstOrThrow()
      const remaining = Number(remainingRow.remaining)
      if (remaining === 0) {
        await db
          .updateTable('greenfield_recovery_code_sets')
          .set({state: 'exhausted', invalidated_at: now})
          .where('set_id', '=', row.set_id)
          .execute()
      }
      await this.credentials.forDb(db).markMethodUsed(row.method_id, now)
      await this.securityEvents.forDb(db).record({
        accountId,
        sessionId: input.sessionId ?? null,
        eventType: 'recovery_code.used',
        methodType: 'recovery_code',
        methodId: row.method_id,
        severity: 'critical',
        ipHash: input.ipHash ?? null,
        userAgent: input.userAgent ?? null,
        metadata: {remaining},
        createdAt: now,
      })
      return {consumed: true, methodId: row.method_id, remaining}
    })
  }

  async remaining(accountId: string): Promise<{remaining: number; setId: string | null; generatedAt: string | null}> {
    const activeSet = await this.db
      .selectFrom('greenfield_recovery_code_sets')
      .select(['set_id', 'generated_at'])
      .where('account_id', '=', accountId)
      .where('state', '=', 'active')
      .orderBy('generated_at', 'desc')
      .executeTakeFirst()
    if (!activeSet) return {remaining: 0, setId: null, generatedAt: null}
    const count = await this.db
      .selectFrom('greenfield_recovery_codes')
      .select(({fn}) => fn.countAll<number>().as('remaining'))
      .where('set_id', '=', activeSet.set_id)
      .where('used_at', 'is', null)
      .executeTakeFirstOrThrow()
    return {remaining: Number(count.remaining), setId: activeSet.set_id, generatedAt: activeSet.generated_at.toISOString()}
  }

  async invalidateActive(accountId: string, now = new Date()): Promise<void> {
    await this.db
      .updateTable('greenfield_recovery_code_sets')
      .set({state: 'invalidated', invalidated_at: now})
      .where('account_id', '=', accountId)
      .where('state', '=', 'active')
      .execute()
  }

  private executeWrite<T>(fn: (db: Db) => Promise<T>): Promise<T> {
    const candidate = this.db as Db & {isTransaction?: boolean}
    if (!candidate.isTransaction && 'transaction' in candidate && typeof candidate.transaction === 'function') {
      return candidate.transaction().execute(fn)
    }
    return fn(this.db)
  }
}

function uniqueRecoveryCodes(count: number): string[] {
  const codes = new Set<string>()
  while (codes.size < count) codes.add(generateHumanRecoveryCode())
  return Array.from(codes)
}
