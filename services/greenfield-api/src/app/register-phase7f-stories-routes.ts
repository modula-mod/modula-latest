import {readFile} from 'node:fs/promises'
import {join} from 'node:path'

import type {FastifyInstance} from 'fastify'

import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {SOCIAL_FEATURES_ALL_OFF, type SocialFeaturesConfig} from '../config/env.js'
import type {MessagingRealtimeHub} from '../domains/messaging/realtime-hub.js'
import {StoryService, storyItemLiveCutoff} from '../domains/stories/service.js'
import {HIGHLIGHT_ITEMS_MAX, HIGHLIGHT_TITLE_MAX, HIGHLIGHTS_MAX_PER_OWNER, StorySocialService} from '../domains/stories/social.js'
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
    if (error?.details?.reason) {
      return reply.code(statusForError(code)).send(failureEnvelope(code, error.message ?? fallback, requestId, {details: {reason: error.details.reason}}))
    }
    return sendError(reply, code, error.message ?? fallback, requestId)
  }
  return sendError(reply, 'SERVER_ERROR', fallback, requestId)
}

/**
 * Optional-auth routes treat a missing Authorization header as anonymous, but a
 * header that is present and does not resolve to a live session (invalid,
 * expired or revoked) must be rejected so clients refresh or sign out instead
 * of silently receiving the anonymous view.
 */
function rejectUnresolvedAuthorization(request: any, reply: any): boolean {
  const header = request.headers?.authorization
  const present = typeof header === 'string' ? header.trim().length > 0 : Array.isArray(header) && header.length > 0
  if (present && !request.auth) {
    sendError(reply, 'UNAUTHENTICATED', 'Authentication required', request.id)
    return true
  }
  return false
}

const storyReplyContract = {
  attachValidation: true,
  schema: {
    params: {
      type: 'object',
      additionalProperties: false,
      required: ['storyId'],
      properties: {storyId: {type: 'string', format: 'uuid'}},
    },
    body: {
      type: 'object',
      // Preserve unknown fields so the authenticated handler can reject them
      // explicitly instead of Fastify silently removing privileged input.
      additionalProperties: true,
      required: ['text', 'idempotencyKey'],
      properties: {
        text: {type: 'string', minLength: 1, maxLength: 5_000},
        idempotencyKey: {type: 'string', minLength: 8, maxLength: 200, pattern: '^[A-Za-z0-9._:-]+$'},
      },
    },
  },
}

export async function registerPhase7fStoriesRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  options: {
    sessions: SessionService
    feedConfig: Record<string, unknown>
    writeConfig: Record<string, unknown>
    /** Delivers story reactions to the owner's open sockets. */
    hub?: MessagingRealtimeHub
    features?: Partial<SocialFeaturesConfig>
  },
): Promise<void> {
  const stories = new StoryService(db, config)
  const social = new StorySocialService(db, stories)
  const {feedConfig, writeConfig} = options
  const features: SocialFeaturesConfig = {...SOCIAL_FEATURES_ALL_OFF, ...(options.features ?? {})}
  const disabled = (reply: any, request: any, what: string) =>
    sendError(reply, 'CAPABILITY_DISABLED', `${what} is not available`, request.id)

  /** Server-declared story capabilities so the client never guesses. */
  app.get('/v1/stories/capabilities', feedConfig, async (request, reply) => {
    if (rejectUnresolvedAuthorization(request, reply)) return reply
    return reply.send(successEnvelope({
      version: 2,
      viewers: features.storyViewers,
      reactions: features.storyReactions ? {enabled: true, kind: 'emoji', singleEmoji: true} : {enabled: false},
      highlights: features.storyHighlights
        ? {enabled: true, maxPerProfile: HIGHLIGHTS_MAX_PER_OWNER, maxItems: HIGHLIGHT_ITEMS_MAX, titleMaxLength: HIGHLIGHT_TITLE_MAX}
        : {enabled: false},
      archive: features.storyHighlights,
    }, request.id))
  })

  app.get('/v1/stories/archive', feedConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    if (!features.storyHighlights) return disabled(reply, request, 'Story archive')
    const q = request.query as {cursor?: string; limit?: string}
    try {
      return reply.send(successEnvelope(await social.listArchive(auth.actorId, q.cursor, q.limit), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load story archive')
    }
  })

  app.get('/v1/stories/items/:itemId/viewers', feedConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    if (!features.storyViewers) return disabled(reply, request, 'Story viewers')
    const {itemId} = request.params as {itemId: string}
    const q = request.query as {cursor?: string; limit?: string}
    try {
      return reply.send(successEnvelope(await social.listViewers(auth.actorId, itemId, q.cursor, q.limit), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load story viewers')
    }
  })

  app.get('/v1/stories/items/:itemId/reactions', feedConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'social:read')
    if (!auth) return
    if (!features.storyReactions) return disabled(reply, request, 'Story reactions')
    const {itemId} = request.params as {itemId: string}
    try {
      return reply.send(successEnvelope(await social.listReactions(auth.actorId, itemId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to load story reactions')
    }
  })

  app.put('/v1/stories/items/:itemId/reaction', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    if (!features.storyReactions) return disabled(reply, request, 'Story reactions')
    const {itemId} = request.params as {itemId: string}
    const body = (request.body ?? {}) as {emoji?: unknown}
    if (typeof body !== 'object' || Object.keys(body).some(key => key !== 'emoji')) {
      return sendError(reply, 'VALIDATION_FAILED', 'Invalid story reaction', request.id)
    }
    try {
      const result = await social.react(auth.actorId, itemId, body.emoji, request.id)
      if (result.changed) {
        options.hub?.publish([result.ownerActorId], {type: 'story.reaction', itemId, groupId: result.groupId, actorId: auth.actorId, emoji: result.emoji, at: result.reactedAt})
      }
      return reply.send(successEnvelope({itemId, emoji: result.emoji, changed: result.changed, reactedAt: result.reactedAt}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to react to story')
    }
  })

  app.delete('/v1/stories/items/:itemId/reaction', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    if (!features.storyReactions) return disabled(reply, request, 'Story reactions')
    const {itemId} = request.params as {itemId: string}
    try {
      const result = await social.removeReaction(auth.actorId, itemId)
      if (result.removed && result.ownerActorId && result.groupId) {
        options.hub?.publish([result.ownerActorId], {type: 'story.reaction', itemId, groupId: result.groupId, actorId: auth.actorId, emoji: null, at: new Date().toISOString()})
      }
      return reply.send(successEnvelope({itemId, removed: result.removed}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to remove story reaction')
    }
  })

  const highlightBody = (body: unknown) => {
    const value = (body ?? {}) as Record<string, unknown>
    if (typeof value !== 'object' || Array.isArray(value)) return null
    if (Object.keys(value).some(key => key !== 'title' && key !== 'itemIds' && key !== 'coverItemId')) return null
    return value as {title?: unknown; itemIds?: unknown; coverItemId?: unknown}
  }

  app.post('/v1/stories/highlights', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    if (!features.storyHighlights) return disabled(reply, request, 'Story highlights')
    const body = highlightBody(request.body)
    if (!body) return sendError(reply, 'VALIDATION_FAILED', 'Invalid highlight request', request.id)
    try {
      return reply.code(201).send(successEnvelope(await social.createHighlight(auth.actorId, body), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to create highlight')
    }
  })

  app.get('/v1/stories/highlights/:highlightId', feedConfig, async (request, reply) => {
    if (rejectUnresolvedAuthorization(request, reply)) return reply
    if (!features.storyHighlights) return disabled(reply, request, 'Story highlights')
    const {highlightId} = request.params as {highlightId: string}
    const highlight = await social.getHighlight(request.auth?.actorId ?? null, highlightId)
    if (!highlight) return sendError(reply, 'NOT_FOUND', 'Highlight not found', request.id)
    return reply.send(successEnvelope(highlight, request.id))
  })

  app.patch('/v1/stories/highlights/:highlightId', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    if (!features.storyHighlights) return disabled(reply, request, 'Story highlights')
    const {highlightId} = request.params as {highlightId: string}
    const body = highlightBody(request.body)
    if (!body) return sendError(reply, 'VALIDATION_FAILED', 'Invalid highlight request', request.id)
    try {
      return reply.send(successEnvelope(await social.updateHighlight(auth.actorId, highlightId, body), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to update highlight')
    }
  })

  app.delete('/v1/stories/highlights/:highlightId', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    if (!features.storyHighlights) return disabled(reply, request, 'Story highlights')
    const {highlightId} = request.params as {highlightId: string}
    try {
      return reply.send(successEnvelope(await social.deleteHighlight(auth.actorId, highlightId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to delete highlight')
    }
  })

  app.get('/v1/profiles/:handle/highlights', feedConfig, async (request, reply) => {
    if (rejectUnresolvedAuthorization(request, reply)) return reply
    if (!features.storyHighlights) return disabled(reply, request, 'Story highlights')
    const {handle} = request.params as {handle: string}
    if (typeof handle !== 'string' || handle.length < 1 || handle.length > 64) {
      return sendError(reply, 'VALIDATION_FAILED', 'Invalid handle', request.id)
    }
    const result = await social.listForProfile(request.auth?.actorId ?? null, handle)
    if (!result) return sendError(reply, 'NOT_FOUND', 'Profile not found', request.id)
    return reply.send(successEnvelope(result, request.id))
  })

  app.get('/v1/stories/rail', feedConfig, async (request, reply) => {
    if (rejectUnresolvedAuthorization(request, reply)) return reply
    const rail = await stories.listRail(request.auth?.actorId ?? null)
    return reply.send(successEnvelope({items: rail}, request.id))
  })

  app.get('/v1/stories/:groupId', feedConfig, async (request, reply) => {
    if (rejectUnresolvedAuthorization(request, reply)) return reply
    const params = request.params as {groupId?: string}
    const groupId = params.groupId ?? ''
    if (!groupId || groupId.startsWith('add:')) {
      return sendError(reply, 'NOT_FOUND', 'Story group not found', request.id)
    }
    const viewer = request.auth?.actorId ?? null
    const group = await stories.getGroup(groupId, viewer)
    if (!group) return sendError(reply, 'NOT_FOUND', 'Story group not found', request.id)
    if (viewer && !group.isOwner && features.storyReactions) {
      // Additive field: the viewer's own reaction per item (null when none).
      const mine = await social.viewerReactions(viewer, group.items.map(item => item.itemId))
      return reply.send(successEnvelope({...group, items: group.items.map(item => ({...item, viewerReaction: mine.get(item.itemId) ?? null}))}, request.id))
    }
    return reply.send(successEnvelope(group, request.id))
  })

  app.post('/v1/stories', writeConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    const body = (request.body ?? {}) as {
      mediaKind?: 'image' | 'video'
      attachmentId?: string
      base64?: string
      contentType?: string
      caption?: string
      visibility?: 'public' | 'followers' | 'close'
      width?: number
      height?: number
      durationMs?: number
      idempotencyKey?: string
    }
    try {
      const created = await stories.create(auth.actorId, {
        mediaKind: body.mediaKind ?? 'image',
        attachmentId: body.attachmentId,
        base64: body.base64,
        contentType: body.contentType,
        caption: body.caption,
        visibility: body.visibility,
        width: body.width,
        height: body.height,
        durationMs: body.durationMs,
        idempotencyKey: body.idempotencyKey,
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

  app.post('/v1/stories/:storyId/replies', {...writeConfig, ...storyReplyContract}, async (request, reply) => {
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    if (request.validationError) {
      return sendError(reply, 'VALIDATION_FAILED', 'Invalid story reply request', request.id)
    }
    const params = request.params as {storyId?: string}
    const body = (request.body ?? {}) as {text?: unknown; idempotencyKey?: unknown}
    if (Object.keys(body).some(key => key !== 'text' && key !== 'idempotencyKey')) {
      return sendError(reply, 'VALIDATION_FAILED', 'Invalid story reply request', request.id)
    }
    try {
      const delivered = await stories.reply(auth.actorId, params.storyId ?? '', body, request.id)
      return reply.code(delivered.created ? 201 : 200).send(successEnvelope(delivered, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Unable to reply to story')
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
      .where('i.created_at', '>', storyItemLiveCutoff())
      .executeTakeFirst()
    const live = Boolean(item && !item.deleted_at && item.expires_at > new Date() && item.status === 'ready')
    // Items kept by an active highlight stay viewable after 24h under the
    // original group's visibility and block policy.
    const highlighted = !live && features.storyHighlights
      ? await social.canViewHighlightedMedia(request.auth?.actorId ?? null, {mediaFileName: mediaFile})
      : false
    if (!live && !highlighted) {
      return sendError(reply, 'NOT_FOUND', 'Media not found', request.id)
    }
    const canView = highlighted || await stories.canViewGroup(
      request.auth?.actorId ?? null,
      item!.owner_actor_id,
      item!.visibility,
    )
    if (!canView) {
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
