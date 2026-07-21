import {randomUUID} from 'node:crypto'
import type {CreateReportInput, ReportDto} from '@modula/api-contracts'
import type {ModulaDb} from '../../database/client.js'

export class ModerationRepository {
  constructor(private readonly db: ModulaDb) {}

  async block(blockerActorId: string, blockedActorId: string): Promise<void> {
    if (blockerActorId === blockedActorId) {
      throw Object.assign(new Error('Cannot block yourself'), {code: 'VALIDATION_FAILED'})
    }
    const existing = await this.db
      .selectFrom('blocks')
      .selectAll()
      .where('blocker_actor_id', '=', blockerActorId)
      .where('blocked_actor_id', '=', blockedActorId)
      .executeTakeFirst()
    const now = new Date()
    if (existing) {
      await this.db
        .updateTable('blocks')
        .set({deleted_at: null, updated_at: now, version: existing.version + 1})
        .where('id', '=', existing.id)
        .execute()
      return
    }
    await this.db
      .insertInto('blocks')
      .values({
        id: randomUUID(),
        blocker_actor_id: blockerActorId,
        blocked_actor_id: blockedActorId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 1,
      })
      .execute()
  }

  async unblock(blockerActorId: string, blockedActorId: string): Promise<void> {
    await this.db
      .updateTable('blocks')
      .set({deleted_at: new Date(), updated_at: new Date()})
      .where('blocker_actor_id', '=', blockerActorId)
      .where('blocked_actor_id', '=', blockedActorId)
      .where('deleted_at', 'is', null)
      .execute()
  }

  async mute(muterActorId: string, mutedActorId: string): Promise<void> {
    if (muterActorId === mutedActorId) {
      throw Object.assign(new Error('Cannot mute yourself'), {code: 'VALIDATION_FAILED'})
    }
    const existing = await this.db
      .selectFrom('mutes')
      .selectAll()
      .where('muter_actor_id', '=', muterActorId)
      .where('muted_actor_id', '=', mutedActorId)
      .executeTakeFirst()
    const now = new Date()
    if (existing) {
      await this.db
        .updateTable('mutes')
        .set({deleted_at: null, updated_at: now, version: existing.version + 1})
        .where('id', '=', existing.id)
        .execute()
      return
    }
    await this.db
      .insertInto('mutes')
      .values({
        id: randomUUID(),
        muter_actor_id: muterActorId,
        muted_actor_id: mutedActorId,
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 1,
      })
      .execute()
  }

  async unmute(muterActorId: string, mutedActorId: string): Promise<void> {
    await this.db
      .updateTable('mutes')
      .set({deleted_at: new Date(), updated_at: new Date()})
      .where('muter_actor_id', '=', muterActorId)
      .where('muted_actor_id', '=', mutedActorId)
      .where('deleted_at', 'is', null)
      .execute()
  }

  async createReport(reporterActorId: string, input: CreateReportInput): Promise<ReportDto> {
    const id = randomUUID()
    const now = new Date()
    await this.db
      .insertInto('reports')
      .values({
        id,
        reporter_actor_id: reporterActorId,
        target_type: input.targetType,
        target_id: input.targetId,
        category: input.category,
        details: input.details ?? '',
        status: 'open',
        created_at: now,
        updated_at: now,
        deleted_at: null,
        version: 1,
      })
      .execute()
    return {
      id,
      targetType: input.targetType,
      targetId: input.targetId,
      category: input.category,
      details: input.details ?? '',
      status: 'open',
      createdAt: now.toISOString(),
    }
  }

  async blockedSet(viewerActorId: string | null): Promise<Set<string>> {
    if (!viewerActorId) return new Set()
    const rows = await this.db
      .selectFrom('blocks')
      .select(['blocker_actor_id', 'blocked_actor_id'])
      .where('deleted_at', 'is', null)
      .where(({eb, or}) =>
        or([eb('blocker_actor_id', '=', viewerActorId), eb('blocked_actor_id', '=', viewerActorId)]),
      )
      .execute()
    const set = new Set<string>()
    for (const row of rows) {
      if (row.blocker_actor_id === viewerActorId) set.add(row.blocked_actor_id)
      else set.add(row.blocker_actor_id)
    }
    return set
  }

  async mutedSet(viewerActorId: string | null): Promise<Set<string>> {
    if (!viewerActorId) return new Set()
    const rows = await this.db
      .selectFrom('mutes')
      .select('muted_actor_id')
      .where('muter_actor_id', '=', viewerActorId)
      .where('deleted_at', 'is', null)
      .execute()
    return new Set(rows.map(r => r.muted_actor_id))
  }
}
