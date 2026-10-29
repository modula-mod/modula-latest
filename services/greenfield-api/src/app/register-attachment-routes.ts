import type {FastifyInstance} from 'fastify'
import {sql} from 'kysely'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {AttachmentService} from '../domains/attachments/service.js'
import {PostRepository} from '../domains/posts/repository.js'
import {ProfileRepository} from '../domains/profiles/repository.js'
import {StoryService, storyItemLiveCutoff} from '../domains/stories/service.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {applyBrowserVisibleMediaHeaders} from './media-response.js'
import {collectionPermission, GreenfieldModuleRuntimeAccessService, mediaPermission} from '../modules/runtime-access.js'

function sendError(reply: any, code: any, message: string, requestId: string) {
  return reply.code(statusForError(code)).send(failureEnvelope(code, message, requestId))
}

function mapError(reply: any, error: any, requestId: string, fallback: string) {
  const code = error?.code
  if (['VALIDATION_FAILED', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT'].includes(code)) {
    return sendError(reply, code, error.message ?? fallback, requestId)
  }
  return sendError(reply, 'SERVER_ERROR', fallback, requestId)
}

export async function registerAttachmentRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  options: {writeConfig: Record<string, unknown>; feedConfig: Record<string, unknown>; mutationsAllowed: boolean},
) {
  const attachments = new AttachmentService(db, config)
  const posts = new PostRepository(db, config.publicApiUrl)
  const profiles = new ProfileRepository(db)
  const stories = new StoryService(db, config)
  const moduleAccess = new GreenfieldModuleRuntimeAccessService(db, config)
  const {writeConfig, feedConfig, mutationsAllowed} = options

  app.post('/v1/attachments/uploads', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'attachment:upload')
    if (!auth) return
    try {
      const created = await attachments.createUpload(auth.accountId, (request.body ?? {}) as any)
      request.log.info({uploadId: created.uploadId, attachmentId: created.attachmentId}, 'attachment upload session created')
      return reply.code(201).send(successEnvelope(created, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to create upload session')
    }
  })

  app.put('/v1/attachments/uploads/:uploadId/content', {
    ...writeConfig,
    bodyLimit: 100 * 1024 * 1024,
  }, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'attachment:upload')
    if (!auth) return
    const {uploadId} = request.params as {uploadId: string}
    try {
      const attachment = await attachments.upload(auth.accountId, uploadId, request.body as any)
      request.log.info({uploadId, attachmentId: attachment.id, status: attachment.status}, 'attachment upload verified')
      return reply.send(successEnvelope({attachment}, request.id))
    } catch (error) {
      request.log.warn({uploadId, code: (error as any)?.code}, 'attachment upload rejected')
      return mapError(reply, error, request.id, 'Unable to upload attachment')
    }
  })

  app.get('/v1/attachments/:attachmentId', feedConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'attachment:upload')
    if (!auth) return
    try {
      const {attachmentId} = request.params as {attachmentId: string}
      return reply.send(successEnvelope({attachment: await attachments.status(auth.accountId, attachmentId)}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to load attachment')
    }
  })

  app.delete('/v1/attachments/:attachmentId', writeConfig, async (request, reply) => {
    if (!mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'attachment:upload')
    if (!auth) return
    try {
      const {attachmentId} = request.params as {attachmentId: string}
      await attachments.removeOrphan(auth.accountId, attachmentId)
      return reply.send(successEnvelope({deleted: true}, request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to remove attachment')
    }
  })

  app.get('/v1/attachments/:attachmentId/content', feedConfig, async (request, reply) => {
    const {attachmentId} = request.params as {attachmentId: string}
    const row = await db.selectFrom('attachments').select(['owner_account_id', 'status'])
      .where('attachment_id', '=', attachmentId).executeTakeFirst()
    if (!row || row.status !== 'ready') return sendError(reply, 'NOT_FOUND', 'Attachment not found', request.id)
    let allowed = request.auth?.accountId === row.owner_account_id
    if (!allowed) {
      const profileBinding = await db.selectFrom('profile_media as media')
        .innerJoin('profiles as profile', 'profile.id', 'media.profile_id')
        .select(['profile.id'])
        .where('media.attachment_id', '=', attachmentId)
        .where('profile.deleted_at', 'is', null)
        .executeTakeFirst()
      allowed = Boolean(profileBinding && await profiles.getById(profileBinding.id, request.auth?.actorId ?? null))
    }
    if (!allowed) {
      const bindings = await db.selectFrom('post_content').select('post_id').where('attachment_id', '=', attachmentId).execute()
      for (const binding of bindings) {
        if (await posts.getById(binding.post_id, request.auth?.actorId ?? null)) { allowed = true; break }
      }
    }
    if (!allowed) {
      // Comment media: visible wherever the comment's post is visible.
      const commentBindings = await db.selectFrom('greenfield_comments').select('post_id')
        .where('deleted_at', 'is', null)
        .where(sql<boolean>`media @> ${JSON.stringify([{type: 'attachment', attachmentId}])}::jsonb`)
        .limit(5).execute()
      for (const binding of commentBindings) {
        if (await posts.getById(binding.post_id, request.auth?.actorId ?? null)) { allowed = true; break }
      }
    }
    if (!allowed) {
      // Story media follows the story group's visibility and block policy. An
      // attachment URL alone never grants access to private story content.
      const storyBinding = await db.selectFrom('greenfield_story_items as item')
        .innerJoin('greenfield_story_groups as group', 'group.group_id', 'item.group_id')
        .select(['group.owner_actor_id', 'group.visibility', 'group.expires_at', 'group.deleted_at'])
        .where('item.attachment_id', '=', attachmentId)
        .where('item.status', '=', 'ready')
        .where('item.deleted_at', 'is', null)
        .where('item.created_at', '>', storyItemLiveCutoff())
        .executeTakeFirst()
      if (storyBinding && !storyBinding.deleted_at && storyBinding.expires_at > new Date()) {
        allowed = await stories.canViewGroup(
          request.auth?.actorId ?? null,
          storyBinding.owner_actor_id,
          storyBinding.visibility,
        )
      }
    }
    if (!allowed && request.auth?.accountId) {
      const moduleBindings = await db.selectFrom('greenfield_module_record_media_bindings as binding')
        .innerJoin('greenfield_module_records as record', join => join
          .onRef('record.account_id', '=', 'binding.record_owner_account_id').onRef('record.module_id', '=', 'binding.module_id')
          .onRef('record.collection', '=', 'binding.record_type').onRef('record.record_id', '=', 'binding.record_id'))
        .select(['binding.record_owner_account_id', 'binding.module_id', 'binding.record_type', 'binding.record_id'])
        .where('binding.asset_id', '=', attachmentId).where('record.deleted_at', 'is', null).limit(20).execute()
      for (const binding of moduleBindings) {
        const owns = binding.record_owner_account_id === request.auth.accountId
        const share = owns ? true : Boolean(await db.selectFrom('greenfield_module_record_shares').select('share_id')
          .where('owner_account_id', '=', binding.record_owner_account_id).where('recipient_account_id', '=', request.auth.accountId)
          .where('module_id', '=', binding.module_id).where('record_type', '=', binding.record_type).where('record_id', '=', binding.record_id)
          .where('revoked_at', 'is', null).where(eb => eb.or([eb('expires_at', 'is', null), eb('expires_at', '>', new Date())])).executeTakeFirst())
        if (!share) continue
        try {
          const runtime = await moduleAccess.resolve(request.auth.accountId, binding.module_id, {requireEnabled: true})
          moduleAccess.enforceCapability(runtime, collectionPermission(binding.module_id, binding.record_type, 'read'))
          moduleAccess.enforceCapability(runtime, mediaPermission(binding.module_id, binding.record_type, 'read'))
          allowed = true
          break
        } catch {
          // Asset identifiers do not bypass module trust, permission review or record access.
        }
      }
    }
    if (!allowed) return sendError(reply, 'FORBIDDEN', 'Attachment unavailable', request.id)
    const stored = await attachments.openStored(attachmentId)
    if (!stored) return sendError(reply, 'NOT_FOUND', 'Attachment not found', request.id)
    return applyBrowserVisibleMediaHeaders(reply).type(stored.contentType).send(stored.stream)
  })
}
