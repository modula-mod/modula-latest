import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import type {FastifyInstance} from 'fastify'

import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {StoryService} from '../domains/stories/service.js'
import {requireCapability} from '../security/auth-context.js'
import type {SessionService} from '../security/session.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {sendBrowserVisibleMedia} from './media-response.js'

function sendError(reply: any, code: any, message: string, requestId: string) {
  return reply.code(statusForError(code)).send(failureEnvelope(code, message, requestId))
}

function mapDomainError(reply: any, error: any, requestId: string, fallback: string) {
  const code = error?.code
  if (
    code === 'VALIDATION_FAILED' ||
    code === 'NOT_FOUND' ||
    code === 'FORBIDDEN' ||
    code === 'CONFLICT' ||
    code === 'UNAUTHENTICATED'
  ) {
    return sendError(reply, code, error.message ?? fallback, requestId)
  }
  return sendError(reply, 'SERVER_ERROR', fallback, requestId)
}

export async function registerPhase7fStoriesRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  options: {
    sessions: SessionService
    feedConfig: Record<string, unknown>
    writeConfig: Record<string, unknown>
  },
): Promise<void> {
  const stories = new StoryService(db, config)
  const {feedConfig, writeConfig} = options

  app.get('/v1/stories/rail', feedConfig, async (request, reply) => {
    const rail = await stories.listRail(request.auth?.actorId ?? null)
    return reply.send(successEnvelope({items: rail}, request.id))
  })

  app.get('/v1/stories/:groupId', feedConfig, async (request, reply) => {
    const params = request.params as {groupId?: string}
    const groupId = params.groupId ?? ''
    if (!groupId || groupId.startsWith('add:')) {
      return sendError(reply, 'NOT_FOUND', 'Story group not found', request.id)
    }
    const group = await stories.getGroup(groupId, request.auth?.actorId ?? null)
    if (!group) return sendError(reply, 'NOT_FOUND', 'Story group not found', request.id)
    return reply.send(successEnvelope(group, request.id))
  })

  app.post('/v1/stories', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    const body = (request.body ?? {}) as {
      mediaKind?: 'image' | 'video'
      base64?: string
      contentType?: string
      caption?: string
      visibility?: 'public' | 'followers' | 'close'
      width?: number
      height?: number
      durationMs?: number
    }
    try {
      const created = await stories.create(auth.actorId, {
        mediaKind: body.mediaKind ?? 'image',
        base64: body.base64 ?? '',
        contentType: body.contentType ?? 'image/jpeg',
        caption: body.caption,
        visibility: body.visibility,
        width: body.width,
        height: body.height,
        durationMs: body.durationMs,
      })
      return reply.code(201).send(successEnvelope(created, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to create story')
    }
  })

  app.post('/v1/stories/items/:itemId/viewed', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    const params = request.params as {itemId?: string}
    try {
      await stories.markViewed(params.itemId ?? '', auth.actorId)
      return reply.send(successEnvelope({ok: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to mark story viewed')
    }
  })

  app.delete('/v1/stories/items/:itemId', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    const params = request.params as {itemId?: string}
    try {
      await stories.deleteItem(params.itemId ?? '', auth.actorId)
      return reply.send(successEnvelope({ok: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to delete story')
    }
  })

  app.get('/v1/media/stories/:mediaFile', feedConfig, async (request, reply) => {
    const params = request.params as {mediaFile?: string}
    const mediaFile = params.mediaFile ?? ''
    const match = /^([0-9a-f-]{36})\.(jpg|png|webp|mp4)$/i.exec(mediaFile)
    if (!match) return sendError(reply, 'NOT_FOUND', 'Media not found', request.id)
    const item = await db
      .selectFrom('greenfield_story_items as i')
      .innerJoin('greenfield_story_groups as g', 'g.group_id', 'i.group_id')
      .select(['i.media_file_name', 'i.status', 'g.owner_actor_id', 'g.visibility', 'g.expires_at', 'g.deleted_at'])
      .where('i.media_file_name', '=', mediaFile)
      .where('i.deleted_at', 'is', null)
      .executeTakeFirst()
    if (!item || item.deleted_at || item.expires_at <= new Date() || item.status !== 'ready') {
      return sendError(reply, 'NOT_FOUND', 'Media not found', request.id)
    }
    const visible = await stories.listRail(request.auth?.actorId ?? null)
    const canView =
      request.auth?.actorId === item.owner_actor_id ||
      visible.some(entry => entry.ownerActorId === item.owner_actor_id && !entry.groupId.startsWith('add:'))
    if (!canView && item.visibility !== 'public') {
      return sendError(reply, 'FORBIDDEN', 'Media unavailable', request.id)
    }
    try {
      const bytes = await readFile(join(config.mediaRoot, 'stories', mediaFile))
      const ext = mediaFile.split('.').pop()?.toLowerCase()
      const contentType =
        ext === 'png'
          ? 'image/png'
          : ext === 'webp'
            ? 'image/webp'
            : ext === 'mp4'
              ? 'video/mp4'
              : 'image/jpeg'
      return sendBrowserVisibleMedia(reply, contentType, bytes)
    } catch {
      return sendError(reply, 'NOT_FOUND', 'Media not found', request.id)
    }
  })
}
