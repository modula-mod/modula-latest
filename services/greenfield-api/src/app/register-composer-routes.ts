import type {FastifyInstance} from 'fastify'
import type {ModulaDb} from '../database/client.js'
import {GifService} from '../domains/gifs/service.js'
import {LinkPreviewService} from '../domains/link-previews/service.js'
import {linkSafety} from '../domains/link-previews/safety.js'
import {StickerService} from '../domains/comments/sticker-service.js'
import {sql} from 'kysely'
import {requireAuth} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

function fail(reply: any, error: any, requestId: string, fallback: string) {
  const code = ['VALIDATION_FAILED', 'INVALID_CURSOR', 'CAPABILITY_DISABLED', 'NOT_FOUND'].includes(error?.code) ? error.code : 'SERVER_ERROR'
  return reply.code(statusForError(code)).send(failureEnvelope(code, code === 'SERVER_ERROR' ? fallback : error.message, requestId))
}

/** Composer support: GIF proxy (server-held provider key) and link previews (SSRF-guarded unfurl). */
export async function registerComposerRoutes(app: FastifyInstance, db: ModulaDb, options: {feedConfig: Record<string, unknown>; publicApiUrl: string}) {
  const gifs = new GifService()
  const previews = new LinkPreviewService(db)

  app.get('/v1/gifs/status', options.feedConfig, async (request, reply) => {
    if (!requireAuth(request, reply)) return
    return reply.send(successEnvelope({configured: gifs.configured, provider: 'giphy'}, request.id))
  })

  app.get('/v1/gifs/trending', options.feedConfig, async (request, reply) => {
    if (!requireAuth(request, reply)) return
    const query = request.query as {limit?: string; offset?: string}
    try {
      return reply.send(successEnvelope(await gifs.trending(query.limit, query.offset), request.id))
    } catch (error) {
      return fail(reply, error, request.id, 'GIFs are unavailable right now')
    }
  })

  app.get('/v1/gifs/search', options.feedConfig, async (request, reply) => {
    if (!requireAuth(request, reply)) return
    const query = request.query as {q?: string; limit?: string; offset?: string}
    try {
      return reply.send(successEnvelope(await gifs.search(query.q, query.limit, query.offset), request.id))
    } catch (error) {
      return fail(reply, error, request.id, 'GIFs are unavailable right now')
    }
  })

  app.get('/v1/link-previews', options.feedConfig, async (request, reply) => {
    if (!requireAuth(request, reply)) return
    try {
      const raw = (request.query as {url?: string}).url
      const [preview, safety] = await Promise.all([previews.preview(raw), linkSafety(db, raw)])
      return reply.send(successEnvelope({preview, safety}, request.id))
    } catch (error) {
      return fail(reply, error, request.id, 'Link preview unavailable')
    }
  })

  /** Safety verdict only (used by the in-app browser before loading a page). */
  app.get('/v1/link-safety', options.feedConfig, async (request, reply) => {
    if (!requireAuth(request, reply)) return
    try {
      return reply.send(successEnvelope(await linkSafety(db, (request.query as {url?: string}).url), request.id))
    } catch (error) {
      return fail(reply, error, request.id, 'Link check unavailable')
    }
  })

  app.get('/v1/stickers/packs', {
    ...options.feedConfig,
    schema: {
      querystring: {
        type: 'object', additionalProperties: false,
        properties: {cursor: {type: 'string', maxLength: 256}, limit: {type: 'integer', minimum: 1, maximum: 50}, series: {type: 'integer', minimum: 1, maximum: 99}},
      },
    },
  }, async (request, reply) => {
    try {
      return reply.send(successEnvelope(await new StickerService(db, options.publicApiUrl).list(request.query as any), request.id))
    } catch (error) {
      return fail(reply, error, request.id, 'Sticker packs unavailable')
    }
  })

  /** Hashtag autocomplete from recent public posts and comments. */
  app.get('/v1/hashtags/suggest', options.feedConfig, async (request, reply) => {
    if (!requireAuth(request, reply)) return
    const q = String((request.query as {q?: string}).q ?? '').replace(/^#/, '').toLowerCase()
    if (!/^[a-z0-9_]{0,40}$/.test(q)) return reply.send(successEnvelope({items: []}, request.id))
    try {
      const rows = await sql<{tag: string; uses: number}>`
        SELECT lower(m[1]) AS tag, count(*)::int AS uses FROM (
          SELECT text FROM posts WHERE deleted_at IS NULL AND audience = 'public' AND text LIKE '%#%' AND created_at > NOW() - INTERVAL '180 days'
          UNION ALL
          SELECT c.text FROM greenfield_comments c JOIN posts p ON p.id = c.post_id
          WHERE c.deleted_at IS NULL AND p.deleted_at IS NULL AND p.audience = 'public' AND c.text LIKE '%#%' AND c.created_at > NOW() - INTERVAL '180 days'
        ) src, regexp_matches(src.text, '#([A-Za-z0-9_]{2,40})', 'g') AS m
        WHERE lower(m[1]) LIKE ${q + '%'}
        GROUP BY 1 ORDER BY uses DESC, tag ASC LIMIT 8`.execute(db)
      return reply.send(successEnvelope({items: rows.rows}, request.id))
    } catch (error) {
      return fail(reply, error, request.id, 'Hashtag suggestions unavailable')
    }
  })
}
