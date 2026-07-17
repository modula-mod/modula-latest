import type {BackendCapability} from '@modula/api-contracts'
import type {FastifyReply, FastifyRequest} from 'fastify'
import type {AppConfig} from '../config/index.js'
import {failureEnvelope, statusForError} from '../transport/envelope.js'
import type {ResolvedSession, SessionService} from './session.js'

declare module 'fastify' {
  interface FastifyRequest {
    authContext?: ResolvedSession
  }
}

function sendAuthError(reply: FastifyReply, code: 'UNAUTHENTICATED' | 'SESSION_EXPIRED' | 'FORBIDDEN' | 'CAPABILITY_DISABLED', message: string) {
  const requestId = reply.request.id
  return reply.code(statusForError(code)).send(failureEnvelope(code, message, requestId))
}

export function extractBearerToken(authorizationHeader: string | string[] | undefined): string | null {
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  if (!match) return null
  const token = match[1]?.trim()
  return token && token.length > 0 ? token : null
}

/**
 * Resolves the session for every request that reaches it, but does not
 * reject unauthenticated requests — use this on routes that behave
 * differently for guests vs. authenticated actors (e.g. feeds that must
 * filter blocks for the viewer but remain publicly readable).
 */
export function attachOptionalSession(sessions: SessionService) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const token = extractBearerToken(request.headers.authorization)
    if (!token) return
    const resolved = await sessions.resolveSession(token)
    if (resolved) request.authContext = resolved
  }
}

/** Rejects the request unless it carries a valid, active session. */
export function requireSession(sessions: SessionService) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = extractBearerToken(request.headers.authorization)
    if (!token) {
      return sendAuthError(reply, 'UNAUTHENTICATED', 'Authentication required')
    }
    const resolved = await sessions.resolveSession(token)
    if (!resolved) {
      return sendAuthError(reply, 'SESSION_EXPIRED', 'Session is invalid, expired, or revoked')
    }
    request.authContext = resolved
  }
}

/** Must run after `requireSession`. Rejects if the session lacks `capability`. */
export function requireCapability(capability: BackendCapability) {
  return async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const ctx = request.authContext
    if (!ctx) {
      return sendAuthError(reply, 'UNAUTHENTICATED', 'Authentication required')
    }
    if (!ctx.capabilities.includes(capability)) {
      return sendAuthError(reply, 'FORBIDDEN', `Session is missing required capability: ${capability}`)
    }
  }
}

/** Rejects mutation routes when the environment disables writes (always true in production). */
export function requireMutationsEnabled(config: AppConfig) {
  return async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!config.mutationsEnabled) {
      return sendAuthError(reply, 'CAPABILITY_DISABLED', 'Mutations are disabled in this environment')
    }
  }
}

/** Reads the resolved session set by `requireSession`. Throws if called on a route without it. */
export function getAuthContext(request: FastifyRequest): ResolvedSession {
  if (!request.authContext) {
    throw Object.assign(new Error('Route is missing requireSession preHandler'), {code: 'SERVER_ERROR' as const})
  }
  return request.authContext
}
