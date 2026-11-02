import {randomUUID} from 'node:crypto'
import type {
  CreatePostContentInput,
  CreatePostDraftInput,
  PostDraftDto,
  UpdatePostDraftInput,
} from '@modula/api-contracts'
import type {Transaction} from 'kysely'
import type {AppConfig} from '../../config/index.js'
import type {ModulaDb} from '../../database/client.js'
import type {Database} from '../../database/types.js'
import {AuditRepository} from '../audit/repository.js'
import {PostWriteService} from '../posts/writes.js'

export type DraftRequestContext = {
  accountId?: string | null
  requestId?: string | null
  correlationId?: string | null
}

export class PostDraftService {
  private readonly postWrites: PostWriteService

  constructor(private readonly db: ModulaDb, config: AppConfig) {
    this.postWrites = new PostWriteService(db, config)
  }

  async list(actorId: string, limit: number, cursor: string | null): Promise<PostDraftDto[]> {
    const decoded = decodeDraftCursor(cursor)
    let query = this.db.selectFrom('greenfield_post_drafts').selectAll()
      .where('owner_actor_id', '=', actorId).where('deleted_at', 'is', null).where('state', '=', 'editing')
      .orderBy('updated_at', 'desc').orderBy('draft_id', 'desc').limit(limit + 1)
    if (decoded) {
      query = query.where(eb => eb.or([
        eb('updated_at', '<', decoded.updatedAt),
        eb.and([eb('updated_at', '=', decoded.updatedAt), eb('draft_id', '<', decoded.id)]),
      ]))
    }
    return Promise.all((await query.execute()).map(row => this.toDto(row)))
  }

  async get(actorId: string, draftId: string): Promise<PostDraftDto> {
    const row = await this.ownedDraft(actorId, draftId)
    return this.toDto(row)
  }

  async create(actorId: string, input: CreatePostDraftInput, context: DraftRequestContext = {}): Promise<{draft: PostDraftDto; created: boolean}> {
    const normalized = normalizeDraft(input)
    if (normalized.idempotencyKey) {
      const existing = await this.db.selectFrom('greenfield_post_drafts').selectAll()
        .where('owner_actor_id', '=', actorId).where('idempotency_key', '=', normalized.idempotencyKey)
        .where('deleted_at', 'is', null).executeTakeFirst()
      if (existing) return {draft: await this.assertIdempotentPayload(existing, normalized), created: false}
    }
    const id = randomUUID()
    const now = new Date()
    try {
      await this.db.transaction().execute(async trx => {
        await trx.insertInto('greenfield_post_drafts').values({
          draft_id: id, owner_actor_id: actorId, idempotency_key: normalized.idempotencyKey,
          text: normalized.text, feed: normalized.feed, audience: normalized.audience,
          reply_permission: normalized.replyPermission, publish_to_atproto: normalized.publishToAtproto,
          state: 'editing', published_post_id: null, created_at: now, updated_at: now,
          deleted_at: null, version: 1,
        }).execute()
        await replaceDraftContent(trx, actorId, id, normalized.content, now)
        await new AuditRepository(trx).append('post-draft.created', {attachmentCount: normalized.content.length},
          {type: 'postDraft', id, actorId}, auditContext(context))
      })
    } catch (error) {
      if (normalized.idempotencyKey && (error as {code?: string})?.code === '23505') {
        const existing = await this.db.selectFrom('greenfield_post_drafts').selectAll()
          .where('owner_actor_id', '=', actorId).where('idempotency_key', '=', normalized.idempotencyKey)
          .where('deleted_at', 'is', null).executeTakeFirst()
        if (existing) return {draft: await this.assertIdempotentPayload(existing, normalized), created: false}
      }
      if ((error as {code?: string})?.code === '23505') throw domainError('An attachment is already reserved by another draft', 'CONFLICT')
      throw error
    }
    return {draft: await this.get(actorId, id), created: true}
  }

  async update(
    actorId: string,
    draftId: string,
    input: UpdatePostDraftInput,
    context: DraftRequestContext = {},
  ): Promise<PostDraftDto> {
    try {
      await this.db.transaction().execute(async trx => {
        const row = await trx.selectFrom('greenfield_post_drafts').selectAll()
          .where('draft_id', '=', draftId).where('owner_actor_id', '=', actorId)
          .where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
        if (!row) throw domainError('Draft not found', 'NOT_FOUND')
        if (row.state !== 'editing') throw domainError('Published drafts cannot be edited', 'CONFLICT')
        if (row.version !== input.expectedVersion) throw domainError('Draft version conflict', 'CONFLICT')
        const currentContent = await draftContent(trx, draftId)
        const normalized = normalizeDraft({
          text: input.text ?? row.text,
          feed: input.feed ?? row.feed,
          audience: input.audience ?? row.audience,
          replyPermission: input.replyPermission ?? row.reply_permission,
          content: input.content ?? currentContent,
          publishToAtproto: input.publishToAtproto ?? row.publish_to_atproto,
        })
        const now = new Date()
        await trx.updateTable('greenfield_post_drafts').set({
          text: normalized.text, feed: normalized.feed, audience: normalized.audience,
          reply_permission: normalized.replyPermission, publish_to_atproto: normalized.publishToAtproto,
          updated_at: now, version: row.version + 1,
        }).where('draft_id', '=', draftId).where('version', '=', input.expectedVersion).executeTakeFirstOrThrow()
        await replaceDraftContent(trx, actorId, draftId, normalized.content, now)
        await new AuditRepository(trx).append('post-draft.updated', {
          expectedVersion: input.expectedVersion, attachmentCount: normalized.content.length,
        }, {type: 'postDraft', id: draftId, actorId}, auditContext(context))
      })
    } catch (error) {
      if ((error as {code?: string})?.code === '23505') throw domainError('An attachment is already reserved by another draft', 'CONFLICT')
      throw error
    }
    return this.get(actorId, draftId)
  }

  async remove(
    actorId: string,
    draftId: string,
    expectedVersion: number,
    context: DraftRequestContext = {},
  ): Promise<void> {
    await this.db.transaction().execute(async trx => {
      const row = await trx.selectFrom('greenfield_post_drafts').selectAll()
        .where('draft_id', '=', draftId).where('owner_actor_id', '=', actorId)
        .where('deleted_at', 'is', null).forUpdate().executeTakeFirst()
      if (!row) throw domainError('Draft not found', 'NOT_FOUND')
      if (row.version !== expectedVersion) throw domainError('Draft version conflict', 'CONFLICT')
      const now = new Date()
      await trx.deleteFrom('greenfield_post_draft_content').where('draft_id', '=', draftId).execute()
      await trx.updateTable('greenfield_post_drafts')
        .set({deleted_at: now, updated_at: now, version: row.version + 1})
        .where('draft_id', '=', draftId).execute()
      await new AuditRepository(trx).append('post-draft.deleted', {expectedVersion},
        {type: 'postDraft', id: draftId, actorId}, auditContext(context))
    })
  }

  async publish(
    actorId: string,
    draftId: string,
    expectedVersion: number,
    context: DraftRequestContext = {},
  ): Promise<{draft: PostDraftDto; postId: string; created: boolean}> {
    const draft = await this.get(actorId, draftId)
    if (draft.state === 'published') {
      if (!draft.publishedPostId) throw new Error('Published draft is missing its post identity')
      return {draft, postId: draft.publishedPostId, created: false}
    }
    if (draft.version !== expectedVersion) throw domainError('Draft version conflict', 'CONFLICT')
    let finalized = false
    const post = await this.postWrites.create(actorId, {
      text: draft.text,
      feed: draft.feed,
      audience: draft.audience,
      replyPermission: draft.replyPermission,
      content: draft.content,
      idempotencyKey: `draft-publish:${draftId}`,
      publishToAtproto: draft.publishToAtproto,
    }, {
      requestId: context.requestId,
      correlationId: context.correlationId,
      draftId,
      transactionalFinalize: async (trx, postId, now) => {
        const updated = await trx.updateTable('greenfield_post_drafts').set({
          state: 'published', published_post_id: postId, updated_at: now, version: expectedVersion + 1,
        }).where('draft_id', '=', draftId).where('owner_actor_id', '=', actorId)
          .where('state', '=', 'editing').where('deleted_at', 'is', null)
          .where('version', '=', expectedVersion).executeTakeFirst()
        if (updated.numUpdatedRows !== 1n) throw domainError('Draft changed before publication completed', 'CONFLICT')
        await new AuditRepository(trx).append('post-draft.published', {expectedVersion, postId},
          {type: 'postDraft', id: draftId, actorId}, auditContext(context))
        finalized = true
      },
    })
    const published = await this.get(actorId, draftId)
    if (published.state !== 'published' || published.publishedPostId !== post.id) {
      throw new Error('Draft publication did not commit atomically')
    }
    return {draft: published, postId: post.id, created: finalized}
  }

  private async ownedDraft(actorId: string, draftId: string) {
    const row = await this.db.selectFrom('greenfield_post_drafts').selectAll()
      .where('draft_id', '=', draftId).where('owner_actor_id', '=', actorId)
      .where('deleted_at', 'is', null).executeTakeFirst()
    if (!row) throw domainError('Draft not found', 'NOT_FOUND')
    return row
  }

  private async toDto(row: Database['greenfield_post_drafts']): Promise<PostDraftDto> {
    return {
      id: row.draft_id, idempotencyKey: row.idempotency_key, text: row.text, feed: row.feed,
      audience: row.audience, replyPermission: row.reply_permission, content: await draftContent(this.db, row.draft_id),
      publishToAtproto: row.publish_to_atproto, state: row.state, publishedPostId: row.published_post_id,
      version: row.version, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
    }
  }

  private async assertIdempotentPayload(row: Database['greenfield_post_drafts'], normalized: NormalizedDraft): Promise<PostDraftDto> {
    const draft = await this.toDto(row)
    const existing = normalizeDraft(draft)
    if (JSON.stringify(payloadIdentity(existing)) !== JSON.stringify(payloadIdentity(normalized))) {
      throw domainError('Draft idempotency key was reused with different content', 'CONFLICT')
    }
    return draft
  }
}

type NormalizedDraft = {
  idempotencyKey: string | null
  text: string
  feed: Database['greenfield_post_drafts']['feed']
  audience: Database['greenfield_post_drafts']['audience']
  replyPermission: Database['greenfield_post_drafts']['reply_permission']
  content: CreatePostContentInput[]
  publishToAtproto: boolean
}

function normalizeDraft(input: CreatePostDraftInput | PostDraftDto): NormalizedDraft {
  const text = typeof input.text === 'string' ? input.text.trim() : ''
  const content = normalizeContent(input.content)
  if (!text && content.length === 0) throw domainError('A draft must contain text or an attachment', 'VALIDATION_FAILED')
  if (text.length > 5000) throw domainError('Draft text is too long', 'VALIDATION_FAILED')
  const feed = input.feed ?? 'following'
  const audience = input.audience ?? 'public'
  const replyPermission = input.replyPermission ?? 'everyone'
  if (!['following', 'forYou', 'modules'].includes(feed)) throw domainError('Invalid draft feed', 'VALIDATION_FAILED')
  if (!['public', 'followers', 'private'].includes(audience)) throw domainError('Invalid draft audience', 'VALIDATION_FAILED')
  if (!['everyone', 'followers', 'mentioned', 'none'].includes(replyPermission)) throw domainError('Invalid reply permission', 'VALIDATION_FAILED')
  const publishToAtproto = input.publishToAtproto ?? false
  if (publishToAtproto && content.length > 0) throw domainError('AT Protocol media publishing is not supported', 'VALIDATION_FAILED')
  const idempotencyKey = 'idempotencyKey' in input && typeof input.idempotencyKey === 'string'
    ? input.idempotencyKey.trim() : null
  if (idempotencyKey && idempotencyKey.length > 200) throw domainError('Draft idempotency key is too long', 'VALIDATION_FAILED')
  return {idempotencyKey: idempotencyKey || null, text, feed, audience, replyPermission, content, publishToAtproto}
}

function normalizeContent(input: CreatePostContentInput[] | undefined): CreatePostContentInput[] {
  if (!input) return []
  if (!Array.isArray(input) || input.length > 10) throw domainError('A draft supports at most 10 attachments', 'VALIDATION_FAILED')
  const seen = new Set<string>()
  return input.map(item => {
    if (!item || !['image', 'video', 'audio', 'pdf', 'document'].includes(item.type) || typeof item.attachmentId !== 'string') {
      throw domainError('Invalid draft attachment', 'VALIDATION_FAILED')
    }
    if (seen.has(item.attachmentId)) throw domainError('Draft attachments must be unique', 'VALIDATION_FAILED')
    seen.add(item.attachmentId)
    const caption = typeof item.caption === 'string' ? item.caption.trim() : undefined
    if (caption && caption.length > 1000) throw domainError('Draft attachment caption is too long', 'VALIDATION_FAILED')
    return {type: item.type, attachmentId: item.attachmentId, ...(caption ? {caption} : {})}
  })
}

async function replaceDraftContent(
  trx: Transaction<Database>,
  actorId: string,
  draftId: string,
  content: CreatePostContentInput[],
  now: Date,
): Promise<void> {
  const actor = await trx.selectFrom('actors').select('account_id').where('id', '=', actorId).executeTakeFirst()
  if (!actor?.account_id) throw domainError('Draft owner account is unavailable', 'FORBIDDEN')
  const attachments = content.length === 0 ? [] : await trx.selectFrom('attachments').selectAll()
    .where('attachment_id', 'in', content.map(item => item.attachmentId)).forUpdate().execute()
  if (attachments.length !== content.length) throw domainError('One or more draft attachments are unavailable', 'VALIDATION_FAILED')
  const byId = new Map(attachments.map(item => [item.attachment_id, item]))
  for (const item of content) {
    const attachment = byId.get(item.attachmentId)
    if (!attachment || attachment.owner_account_id !== actor.account_id) throw domainError('Cross-account attachment binding denied', 'FORBIDDEN')
    if (attachment.status !== 'ready' || attachment.attached_at) throw domainError('Draft attachment is not ready', 'CONFLICT')
    if (attachment.kind !== item.type) throw domainError('Draft attachment type mismatch', 'VALIDATION_FAILED')
  }
  await trx.deleteFrom('greenfield_post_draft_content').where('draft_id', '=', draftId).execute()
  for (const [position, item] of content.entries()) {
    await trx.insertInto('greenfield_post_draft_content').values({
      draft_id: draftId, attachment_id: item.attachmentId, content_type: item.type,
      caption: item.caption?.trim() || null, position, created_at: now,
    }).execute()
  }
}

async function draftContent(db: ModulaDb | Transaction<Database>, draftId: string): Promise<CreatePostContentInput[]> {
  return (await db.selectFrom('greenfield_post_draft_content').selectAll()
    .where('draft_id', '=', draftId).orderBy('position', 'asc').execute()).map(row => ({
      type: row.content_type, attachmentId: row.attachment_id, ...(row.caption ? {caption: row.caption} : {}),
    }))
}

function payloadIdentity(value: NormalizedDraft) {
  return {text: value.text, feed: value.feed, audience: value.audience, replyPermission: value.replyPermission,
    content: value.content, publishToAtproto: value.publishToAtproto}
}

function decodeDraftCursor(cursor: string | null): {updatedAt: Date; id: string} | null {
  if (!cursor) return null
  const separator = cursor.lastIndexOf('|')
  const updatedAt = new Date(cursor.slice(0, separator))
  const id = cursor.slice(separator + 1)
  if (separator < 1 || Number.isNaN(updatedAt.valueOf()) || !id) throw domainError('Invalid draft cursor', 'VALIDATION_FAILED')
  return {updatedAt, id}
}

function auditContext(context: DraftRequestContext) {
  return {accountId: context.accountId ?? null, requestId: context.requestId ?? null,
    correlationId: context.correlationId ?? context.requestId ?? null}
}

function domainError(message: string, code: 'VALIDATION_FAILED' | 'NOT_FOUND' | 'FORBIDDEN' | 'CONFLICT') {
  return Object.assign(new Error(message), {code})
}
