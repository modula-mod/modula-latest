import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {RecoveryService} from '../accounts/recovery.js'
import {AppearanceService} from '../domains/appearance/service.js'
import {CommentService} from '../domains/comments/service.js'
import {MentionService} from '../domains/mentions/service.js'
import {QuoteService} from '../domains/quotes/service.js'
import {ReactionService} from '../domains/reactions/service.js'
import {SaveService} from '../domains/saves/service.js'
import {ExtensionLifecycleService} from '../extensions/lifecycle-service.js'
import {FunctionJobService} from '../functions/job-service.js'
import {GreenfieldSessionService} from '../sessions/service.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

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
    code === 'UNAUTHENTICATED' ||
    code === 'CAPABILITY_DISABLED'
  ) {
    return sendError(reply, code, error.message ?? fallback, requestId)
  }
  return sendError(reply, 'SERVER_ERROR', fallback, requestId)
}

export async function registerPhase6sRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  opts: {
    greenfieldSessions: GreenfieldSessionService
    mutationsAllowed: boolean
    writeConfig: Record<string, unknown>
    feedConfig: Record<string, unknown>
    profileConfig: Record<string, unknown>
    authWriteConfig: Record<string, unknown>
  },
): Promise<void> {
  const reactions = new ReactionService(db)
  const comments = new CommentService(db)
  const quotes = new QuoteService(db)
  const saves = new SaveService(db)
  const mentions = new MentionService(db)
  const appearance = new AppearanceService(db)
  const recovery = new RecoveryService(db, config)
  const lifecycle = new ExtensionLifecycleService(db)
  const functionJobs = new FunctionJobService(db)

  const requireGreenfieldAuth = async (request: any, reply: any) => {
    const header = request.headers.authorization
    const resolved = header?.startsWith('Bearer ')
      ? await opts.greenfieldSessions.resolveAccess(header.slice(7).trim())
      : null
    if (!resolved) {
      sendError(reply, 'UNAUTHENTICATED', 'Authentication required', request.id)
      return null
    }
    return resolved
  }

  // --- Reactions ---
  app.put('/v1/posts/:postId/reaction', opts.writeConfig, async (request, reply) => {
    if (!opts.mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      const {postId} = request.params as {postId: string}
      const type = (request.body as {type?: string} | null)?.type ?? null
      const summary = await reactions.setReaction(auth.actorId, postId, type as any)
      return reply.send(successEnvelope(summary, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Reaction failed')
    }
  })
  app.delete('/v1/posts/:postId/reaction', opts.writeConfig, async (request, reply) => {
    if (!opts.mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      const {postId} = request.params as {postId: string}
      return reply.send(successEnvelope(await reactions.setReaction(auth.actorId, postId, null), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Reaction removal failed')
    }
  })
  app.get('/v1/posts/:postId/reactions', opts.feedConfig, async (request, reply) => {
    try {
      const {postId} = request.params as {postId: string}
      return reply.send(
        successEnvelope(await reactions.listReactions(request.auth?.actorId ?? null, postId), request.id),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Failed to load reactions')
    }
  })

  // --- Comments ---
  app.get('/v1/posts/:postId/comments', opts.feedConfig, async (request, reply) => {
    try {
      const {postId} = request.params as {postId: string}
      const items = await comments.listComments(request.auth?.actorId ?? null, postId)
      return reply.send(successEnvelope({items}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Failed to load comments')
    }
  })
  app.post('/v1/posts/:postId/comments', opts.writeConfig, async (request, reply) => {
    if (!opts.mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      const {postId} = request.params as {postId: string}
      const text = String((request.body as any)?.text ?? '')
      const created = await comments.createComment(auth.actorId, postId, text)
      await mentions.storeMentions(auth.actorId, 'comment', created.comment_id, text)
      return reply.code(201).send(successEnvelope(created, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Failed to create comment')
    }
  })
  app.get('/v1/comments/:commentId/replies', opts.feedConfig, async (request, reply) => {
    try {
      const {commentId} = request.params as {commentId: string}
      const items = await comments.listReplies(request.auth?.actorId ?? null, commentId)
      return reply.send(successEnvelope({items}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Failed to load replies')
    }
  })
  app.post('/v1/comments/:commentId/replies', opts.writeConfig, async (request, reply) => {
    if (!opts.mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      const {commentId} = request.params as {commentId: string}
      const text = String((request.body as any)?.text ?? '')
      const created = await comments.createReply(auth.actorId, commentId, text)
      await mentions.storeMentions(auth.actorId, 'comment', created.comment_id, text)
      return reply.code(201).send(successEnvelope(created, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Failed to create reply')
    }
  })
  app.patch('/v1/comments/:commentId', opts.writeConfig, async (request, reply) => {
    if (!opts.mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      const {commentId} = request.params as {commentId: string}
      const body = request.body as {text?: string; expectedVersion?: number}
      const updated = await comments.updateComment(
        auth.actorId,
        commentId,
        String(body.text ?? ''),
        Number(body.expectedVersion),
      )
      return reply.send(successEnvelope(updated, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Failed to update comment')
    }
  })
  app.delete('/v1/comments/:commentId', opts.writeConfig, async (request, reply) => {
    if (!opts.mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      const {commentId} = request.params as {commentId: string}
      await comments.deleteComment(auth.actorId, commentId)
      return reply.send(successEnvelope({deleted: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Failed to delete comment')
    }
  })
  app.put('/v1/comments/:commentId/reaction', opts.writeConfig, async (request, reply) => {
    if (!opts.mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      const {commentId} = request.params as {commentId: string}
      const type = (request.body as {type?: string} | null)?.type ?? null
      await comments.setCommentReaction(auth.actorId, commentId, type as any)
      return reply.send(successEnvelope({ok: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Comment reaction failed')
    }
  })
  app.delete('/v1/comments/:commentId/reaction', opts.writeConfig, async (request, reply) => {
    if (!opts.mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:engage')
    if (!auth) return
    try {
      const {commentId} = request.params as {commentId: string}
      await comments.setCommentReaction(auth.actorId, commentId, null)
      return reply.send(successEnvelope({ok: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Comment reaction removal failed')
    }
  })

  // --- Quote / save list (repost already exists) ---
  app.post('/v1/posts/:postId/quote', opts.writeConfig, async (request, reply) => {
    if (!opts.mutationsAllowed) return sendError(reply, 'CAPABILITY_DISABLED', 'Mutations disabled', request.id)
    const auth = requireCapability(request, reply, 'post:create')
    if (!auth) return
    try {
      const {postId} = request.params as {postId: string}
      const commentary = String((request.body as any)?.commentary ?? '')
      const created = await quotes.createQuote(auth.actorId, postId, commentary)
      await mentions.storeMentions(auth.actorId, 'post', created.postId, commentary)
      return reply.code(201).send(successEnvelope(created, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Quote failed')
    }
  })
  app.get('/v1/saves', opts.feedConfig, async (request, reply) => {
    const auth = requireCapability(request, reply, 'saved:manage')
    if (!auth) return
    try {
      const items = await saves.listSaves(auth.actorId)
      return reply.send(successEnvelope({items}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Failed to load saves')
    }
  })

  // --- Appearance ---
  app.get('/v1/accounts/me/appearance', opts.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    return reply.send(successEnvelope(await appearance.get(auth.accountId), request.id))
  })
  app.patch('/v1/accounts/me/appearance', opts.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(
        successEnvelope(await appearance.patch(auth.accountId, (request.body as any) ?? {}), request.id),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Appearance update failed')
    }
  })

  // --- Recovery ---
  app.post('/v1/accounts/recovery/request', opts.authWriteConfig, async (request, reply) => {
    try {
      const email = String((request.body as any)?.email ?? '')
      return reply.send(successEnvelope(await recovery.requestRecovery(email), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Recovery request failed')
    }
  })
  app.post('/v1/accounts/recovery/complete', opts.authWriteConfig, async (request, reply) => {
    try {
      const body = request.body as {token?: string; password?: string}
      await recovery.completeRecovery(String(body.token ?? ''), String(body.password ?? ''))
      return reply.send(successEnvelope({recovered: true}, request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Recovery failed')
    }
  })

  // --- Extension lifecycle ---
  app.post('/v1/extensions/:extensionId/enable', opts.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {extensionId} = request.params as {extensionId: string}
      return reply.send(successEnvelope(await lifecycle.enable(auth.accountId, extensionId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Enable failed')
    }
  })
  app.post('/v1/extensions/:extensionId/disable', opts.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {extensionId} = request.params as {extensionId: string}
      return reply.send(successEnvelope(await lifecycle.disable(auth.accountId, extensionId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Disable failed')
    }
  })
  app.patch('/v1/extensions/:extensionId/configuration', opts.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {extensionId} = request.params as {extensionId: string}
      return reply.send(
        successEnvelope(
          await lifecycle.configure(auth.accountId, extensionId, (request.body as any)?.configuration ?? {}),
          request.id,
        ),
      )
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Configuration failed')
    }
  })

  // --- Function jobs ---
  app.get('/v1/function-jobs/:jobId', opts.profileConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {jobId} = request.params as {jobId: string}
      return reply.send(successEnvelope(await functionJobs.getJob(auth.accountId, jobId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Job lookup failed')
    }
  })
  app.post('/v1/function-jobs/:jobId/cancel', opts.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {jobId} = request.params as {jobId: string}
      return reply.send(successEnvelope(await functionJobs.cancel(auth.accountId, jobId), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Cancel failed')
    }
  })

  // Enhance function invoke to support job queue without installation for first-party helpers.
  app.post('/v1/functions/:functionId/jobs', opts.writeConfig, async (request, reply) => {
    const auth = await requireGreenfieldAuth(request, reply)
    if (!auth) return
    try {
      const {functionId} = request.params as {functionId: string}
      const input = ((request.body as any)?.input ?? {}) as Record<string, unknown>
      return reply.code(202).send(successEnvelope(await functionJobs.invoke(auth.accountId, functionId, input), request.id))
    } catch (error) {
      return mapDomainError(reply, error, request.id, 'Function job enqueue failed')
    }
  })
}
