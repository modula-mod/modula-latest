import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {AttachmentService} from '../domains/attachments/service.js'
import {PostRepository} from '../domains/posts/repository.js'
import {ProfileRepository} from '../domains/profiles/repository.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {applyBrowserVisibleMediaHeaders} from './media-response.js'

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
    if (!allowed) return sendError(reply, 'FORBIDDEN', 'Attachment unavailable', request.id)
    const stored = await attachments.openStored(attachmentId)
    if (!stored) return sendError(reply, 'NOT_FOUND', 'Attachment not found', request.id)
    return applyBrowserVisibleMediaHeaders(reply).type(stored.contentType).send(stored.stream)
  })
}
