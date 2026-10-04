import type {FastifyInstance} from 'fastify'
import type {ModulaDb} from '../database/client.js'
import {GifService} from '../domains/gifs/service.js'
import {LinkPreviewService} from '../domains/link-previews/service.js'
import {requireAuth} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

function fail(reply: any, error: any, requestId: string, fallback: string) {
  const code = ['VALIDATION_FAILED', 'CAPABILITY_DISABLED', 'NOT_FOUND'].includes(error?.code) ? error.code : 'SERVER_ERROR'
  return reply.code(statusForError(code)).send(failureEnvelope(code, code === 'SERVER_ERROR' ? fallback : error.message, requestId))
}

/** Composer support: GIF proxy (server-held provider key) and link previews (SSRF-guarded unfurl). */
export async function registerComposerRoutes(app: FastifyInstance, db: ModulaDb, options: {feedConfig: Record<string, unknown>}) {
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
      const preview = await previews.preview((request.query as {url?: string}).url)
      return reply.send(successEnvelope({preview}, request.id))
    } catch (error) {
      return fail(reply, error, request.id, 'Link preview unavailable')
    }
  })
}
