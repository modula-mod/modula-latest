import {randomUUID} from 'node:crypto'
import type {CreateReportInput, ModerationActionType, ReportDto, ReportEvidenceReference, ReportStatus} from '@modula/api-contracts'
import {sql} from 'kysely'
import type {ModulaDb} from '../../database/client.js'
import {AuditRepository} from '../audit/repository.js'

const jsonb = (value: unknown) => sql<unknown>`${JSON.stringify(value)}::jsonb`
const REPORT_TARGETS = new Set(['profile', 'post', 'comment', 'story', 'message', 'other'])
const REPORT_CATEGORIES = new Set(['spam', 'harassment', 'impersonation', 'illegal-content', 'privacy', 'other'])
const REVIEW_STATUSES = new Set<ReportStatus>(['reviewing', 'resolved', 'dismissed'])
const ACTION_TYPES = new Set<ModerationActionType>(['warning_recorded', 'content_removed', 'no_action'])

export class ModerationRepository {
  constructor(private readonly db: ModulaDb) {}

  async block(blockerActorId: string, blockedActorId: string): Promise<void> {
    if (blockerActorId === blockedActorId) {
      throw Object.assign(new Error('Cannot block yourself'), {code: 'VALIDATION_FAILED'})
    }
    await this.db.transaction().execute(async trx => {
      const relationshipKey = [blockerActorId, blockedActorId].sort().join(':')
      await sql`SELECT pg_advisory_xact_lock(hashtextextended(${relationshipKey}, 0))`.execute(trx)
      const existing = await trx
        .selectFrom('blocks')
        .selectAll()
        .where('blocker_actor_id', '=', blockerActorId)
        .where('blocked_actor_id', '=', blockedActorId)
        .executeTakeFirst()
      const now = new Date()
      if (existing) {
        await trx
          .updateTable('blocks')
          .set({deleted_at: null, updated_at: now, version: existing.version + 1})
          .where('id', '=', existing.id)
          .execute()
      } else {
        await trx
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
      await trx
        .updateTable('follows')
        .set({deleted_at: now, updated_at: now, version: sql<number>`version + 1`})
        .where('deleted_at', 'is', null)
        .where(({eb, or, and}) =>
          or([
            and([eb('follower_actor_id', '=', blockerActorId), eb('followed_actor_id', '=', blockedActorId)]),
            and([eb('follower_actor_id', '=', blockedActorId), eb('followed_actor_id', '=', blockerActorId)]),
          ]),
        )
        .execute()
      await trx
        .updateTable('follow_requests')
        .set({status: 'CANCELLED', resolved_at: now, updated_at: now, version: sql<number>`version + 1`})
        .where('status', 'in', ['PENDING', 'ACCEPTED'])
        .where(({eb, or, and}) =>
          or([
            and([eb('requester_actor_id', '=', blockerActorId), eb('target_actor_id', '=', blockedActorId)]),
            and([eb('requester_actor_id', '=', blockedActorId), eb('target_actor_id', '=', blockerActorId)]),
          ]),
        )
        .execute()
      await new AuditRepository(trx).append('social.block.created', {}, {type: 'profile', id: blockedActorId, actorId: blockerActorId})
    })
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
    const targetType = String(input.targetType)
    const category = String(input.category)
    const targetId = boundedText(input.targetId, 300, 'Report target is required')
    if (!REPORT_TARGETS.has(targetType) || !REPORT_CATEGORIES.has(category)) {
      throw Object.assign(new Error('Invalid report target or category'), {code: 'VALIDATION_FAILED'})
    }
    if (!(await this.reportTargetExists(targetType, targetId))) {
      throw Object.assign(new Error('Report target not found'), {code: 'NOT_FOUND'})
    }
    const details = optionalText(input.details, 2_000)
    const evidenceRefs = validateEvidenceRefs(input.evidenceRefs)
    const id = randomUUID()
    const now = new Date()
    await this.db.transaction().execute(async trx => {
      await trx
        .insertInto('reports')
        .values({
          id,
          reporter_actor_id: reporterActorId,
          target_type: targetType as CreateReportInput['targetType'],
          target_id: targetId,
          category: category as CreateReportInput['category'],
          details,
          status: 'open',
          evidence_refs: jsonb(evidenceRefs),
          reviewed_by_actor_id: null,
          reviewed_at: null,
          resolution: null,
          created_at: now,
          updated_at: now,
          deleted_at: null,
          version: 1,
        })
        .execute()
      await new AuditRepository(trx).append(
        'moderation.report.created',
        {targetType, category, evidenceCount: evidenceRefs.length},
        {type: 'report', id, actorId: reporterActorId},
      )
    })
    return this.getReport(id)
  }

  async listForReporter(reporterActorId: string, limit = 50): Promise<ReportDto[]> {
    const rows = await this.db
      .selectFrom('reports')
      .selectAll()
      .where('reporter_actor_id', '=', reporterActorId)
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .limit(Math.max(1, Math.min(limit, 100)))
      .execute()
    return rows.map(mapReport)
  }

  async listReports(input: {status?: string; limit?: number; cursor?: string | null}): Promise<ReportDto[]> {
    const limit = Math.max(1, Math.min(input.limit ?? 50, 100))
    let query = this.db
      .selectFrom('reports')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'asc')
      .orderBy('id', 'asc')
      .limit(limit + 1)
    if (input.status) {
      if (!['open', 'reviewing', 'resolved', 'dismissed'].includes(input.status)) {
        throw Object.assign(new Error('Invalid report status'), {code: 'VALIDATION_FAILED'})
      }
      query = query.where('status', '=', input.status as ReportStatus)
    }
    if (input.cursor) {
      const [createdAt, id] = input.cursor.split('|')
      if (!createdAt || !id || Number.isNaN(new Date(createdAt).getTime())) {
        throw Object.assign(new Error('Invalid cursor'), {code: 'VALIDATION_FAILED'})
      }
      query = query.where(({eb, or, and}) =>
        or([
          eb('created_at', '>', new Date(createdAt)),
          and([eb('created_at', '=', new Date(createdAt)), eb('id', '>', id)]),
        ]),
      )
    }
    return (await query.execute()).map(mapReport)
  }

  async getReport(reportId: string): Promise<ReportDto> {
    const row = await this.db
      .selectFrom('reports')
      .selectAll()
      .where('id', '=', reportId)
      .where('deleted_at', 'is', null)
      .executeTakeFirst()
    if (!row) throw Object.assign(new Error('Report not found'), {code: 'NOT_FOUND'})
    return mapReport(row)
  }

  async reviewReport(input: {
    reportId: string
    reviewerActorId: string
    status: ReportStatus
    resolution?: string
    expectedVersion: number
  }): Promise<ReportDto> {
    if (!REVIEW_STATUSES.has(input.status)) {
      throw Object.assign(new Error('Invalid review status'), {code: 'VALIDATION_FAILED'})
    }
    const resolution = optionalText(input.resolution, 2_000)
    if ((input.status === 'resolved' || input.status === 'dismissed') && !resolution) {
      throw Object.assign(new Error('Resolution is required for a terminal review'), {code: 'VALIDATION_FAILED'})
    }
    await this.db.transaction().execute(async trx => {
      const row = await trx.selectFrom('reports').selectAll().where('id', '=', input.reportId).where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
      if (!row) throw Object.assign(new Error('Report not found'), {code: 'NOT_FOUND'})
      if (row.version !== input.expectedVersion) throw Object.assign(new Error('Report version conflict'), {code: 'CONFLICT'})
      if (row.status === 'resolved' || row.status === 'dismissed') throw Object.assign(new Error('Report is already closed'), {code: 'CONFLICT'})
      const now = new Date()
      const terminal = input.status === 'resolved' || input.status === 'dismissed'
      await trx
        .updateTable('reports')
        .set({
          status: input.status,
          resolution: resolution || null,
          reviewed_by_actor_id: input.reviewerActorId,
          reviewed_at: terminal ? now : null,
          updated_at: now,
          version: row.version + 1,
        })
        .where('id', '=', input.reportId)
        .where('version', '=', input.expectedVersion)
        .executeTakeFirstOrThrow()
      await trx.insertInto('moderation_actions').values({
        id: randomUUID(), report_id: input.reportId, actor_id: input.reviewerActorId,
        action_type: `report_${input.status}`, metadata: jsonb({status: input.status}), created_at: now, updated_at: now,
      }).execute()
      await new AuditRepository(trx).append(
        'moderation.report.reviewed',
        {status: input.status, previousStatus: row.status},
        {type: 'report', id: input.reportId, actorId: input.reviewerActorId},
      )
    })
    return this.getReport(input.reportId)
  }

  async applyAction(input: {
    reportId: string
    reviewerActorId: string
    actionType: ModerationActionType
    note?: string
    expectedVersion: number
  }): Promise<{report: ReportDto; actionId: string; actionType: ModerationActionType}> {
    if (!ACTION_TYPES.has(input.actionType)) throw Object.assign(new Error('Invalid moderation action'), {code: 'VALIDATION_FAILED'})
    const note = optionalText(input.note, 1_000)
    const actionId = randomUUID()
    await this.db.transaction().execute(async trx => {
      const row = await trx.selectFrom('reports').selectAll().where('id', '=', input.reportId).where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
      if (!row) throw Object.assign(new Error('Report not found'), {code: 'NOT_FOUND'})
      if (row.version !== input.expectedVersion) throw Object.assign(new Error('Report version conflict'), {code: 'CONFLICT'})
      if (row.status === 'resolved' || row.status === 'dismissed') throw Object.assign(new Error('Report is already closed'), {code: 'CONFLICT'})
      const now = new Date()
      if (input.actionType === 'content_removed') await this.removeReportedContent(trx as ModulaDb, row.target_type, row.target_id, now)
      const status: ReportStatus = input.actionType === 'no_action' ? 'dismissed' : 'resolved'
      await trx.updateTable('reports').set({
        status,
        resolution: note || input.actionType,
        reviewed_by_actor_id: input.reviewerActorId,
        reviewed_at: now,
        updated_at: now,
        version: row.version + 1,
      }).where('id', '=', input.reportId).where('version', '=', input.expectedVersion).executeTakeFirstOrThrow()
      await trx.insertInto('moderation_actions').values({
        id: actionId, report_id: input.reportId, actor_id: input.reviewerActorId,
        action_type: input.actionType, metadata: jsonb({note: note || null, targetType: row.target_type, targetId: row.target_id}),
        created_at: now, updated_at: now,
      }).execute()
      await new AuditRepository(trx).append(
        'moderation.action.applied',
        {actionType: input.actionType, targetType: row.target_type},
        {type: row.target_type, id: row.target_id, actorId: input.reviewerActorId},
      )
    })
    return {report: await this.getReport(input.reportId), actionId, actionType: input.actionType}
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

  private async reportTargetExists(targetType: string, targetId: string): Promise<boolean> {
    if (targetType === 'post') return Boolean(await this.db.selectFrom('posts').select('id').where('id', '=', targetId).where('deleted_at', 'is', null).executeTakeFirst())
    if (targetType === 'comment') return Boolean(await this.db.selectFrom('greenfield_comments').select('comment_id').where('comment_id', '=', targetId).where('deleted_at', 'is', null).executeTakeFirst())
    if (targetType === 'profile') return Boolean(await this.db.selectFrom('profiles').select('id').where('id', '=', targetId).where('deleted_at', 'is', null).executeTakeFirst())
    if (targetType === 'story') {
      const item = await this.db.selectFrom('greenfield_story_items').select('item_id').where('item_id', '=', targetId).where('deleted_at', 'is', null).executeTakeFirst()
      if (item) return true
      return Boolean(await this.db.selectFrom('greenfield_story_groups').select('group_id').where('group_id', '=', targetId).where('deleted_at', 'is', null).executeTakeFirst())
    }
    return true
  }

  private async removeReportedContent(db: ModulaDb, targetType: string, targetId: string, now: Date): Promise<void> {
    if (targetType === 'post') {
      const result = await db.updateTable('posts').set({deleted_at: now, updated_at: now, version: sql`version + 1`}).where('id', '=', targetId).where('deleted_at', 'is', null).executeTakeFirst()
      if (!Number(result.numUpdatedRows ?? 0)) throw Object.assign(new Error('Reported content not found'), {code: 'NOT_FOUND'})
      return
    }
    if (targetType === 'comment') {
      const comment = await db.selectFrom('greenfield_comments').selectAll().where('comment_id', '=', targetId).where('deleted_at', 'is', null).executeTakeFirst()
      if (!comment) throw Object.assign(new Error('Reported content not found'), {code: 'NOT_FOUND'})
      await db.updateTable('greenfield_comments').set({text: comment.reply_count ? 'Comment removed' : '', deleted_at: now, deletion_kind: 'moderation', updated_at: now, version: comment.version + 1}).where('comment_id', '=', targetId).execute()
      await db.updateTable('posts').set({reply_count: sql`greatest(reply_count - 1, 0)`, updated_at: now}).where('id', '=', comment.post_id).execute()
      if (comment.parent_comment_id) await db.updateTable('greenfield_comments').set({reply_count: sql`greatest(reply_count - 1, 0)`, updated_at: now}).where('comment_id', '=', comment.parent_comment_id).execute()
      return
    }
    if (targetType === 'story') {
      const item = await db.updateTable('greenfield_story_items').set({deleted_at: now}).where('item_id', '=', targetId).where('deleted_at', 'is', null).executeTakeFirst()
      if (Number(item.numUpdatedRows ?? 0)) return
      const group = await db.updateTable('greenfield_story_groups').set({deleted_at: now, updated_at: now}).where('group_id', '=', targetId).where('deleted_at', 'is', null).executeTakeFirst()
      if (Number(group.numUpdatedRows ?? 0)) return
      throw Object.assign(new Error('Reported content not found'), {code: 'NOT_FOUND'})
    }
    throw Object.assign(new Error('Content removal is not valid for this target type'), {code: 'VALIDATION_FAILED'})
  }
}

function mapReport(row: any): ReportDto {
  return {
    id: row.id,
    targetType: row.target_type,
    targetId: row.target_id,
    category: row.category,
    details: row.details,
    status: row.status,
    evidenceRefs: Array.isArray(row.evidence_refs) ? row.evidence_refs : [],
    reviewedByActorId: row.reviewed_by_actor_id,
    reviewedAt: row.reviewed_at?.toISOString() ?? null,
    resolution: row.resolution,
    version: row.version,
    createdAt: row.created_at.toISOString(),
  }
}

function validateEvidenceRefs(value: unknown): ReportEvidenceReference[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 10) throw Object.assign(new Error('Invalid report evidence references'), {code: 'VALIDATION_FAILED'})
  return value.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw Object.assign(new Error('Invalid report evidence reference'), {code: 'VALIDATION_FAILED'})
    const kind = String((item as any).kind)
    const reference = String((item as any).reference ?? '').trim()
    if (!['asset', 'record', 'url'].includes(kind) || !reference || reference.length > 2_048) throw Object.assign(new Error('Invalid report evidence reference'), {code: 'VALIDATION_FAILED'})
    if (kind === 'url') {
      let url: URL
      try { url = new URL(reference) } catch { throw Object.assign(new Error('Invalid evidence URL'), {code: 'VALIDATION_FAILED'}) }
      if (url.protocol !== 'https:' || url.username || url.password) throw Object.assign(new Error('Invalid evidence URL'), {code: 'VALIDATION_FAILED'})
    } else if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/.test(reference)) {
      throw Object.assign(new Error('Invalid evidence reference'), {code: 'VALIDATION_FAILED'})
    }
    return {kind: kind as ReportEvidenceReference['kind'], reference}
  })
}

function boundedText(value: unknown, max: number, message: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text || text.length > max) throw Object.assign(new Error(message), {code: 'VALIDATION_FAILED'})
  return text
}

function optionalText(value: unknown, max: number): string {
  if (value === undefined || value === null) return ''
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length > max) throw Object.assign(new Error('Text value is too long'), {code: 'VALIDATION_FAILED'})
  return text
}
