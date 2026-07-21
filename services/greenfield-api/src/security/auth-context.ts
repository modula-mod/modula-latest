import type {BackendCapability, ModulaSession} from '@modula/api-contracts'
import type {FastifyReply, FastifyRequest} from 'fastify'
import type {SessionService} from './session.js'
import {failureEnvelope, statusForError} from '../transport/envelope.js'

export type AuthContext = {
  session: ModulaSession
  actorId: string
  capabilities: Set<BackendCapability>
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext
  }
}

export async function attachAuth(request: FastifyRequest, sessions: SessionService): Promise<void> {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) return
  const token = header.slice('Bearer '.length).trim()
  const resolved = await sessions.resolveSession(token)
  if (!resolved) return
  request.auth = {
    actorId: resolved.actorId,
    capabilities: new Set(resolved.capabilities),
    session: {
      id: resolved.sessionId,
      actorId: resolved.actorId,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: resolved.expiresAt.toISOString(),
      lastSeenAt: new Date().toISOString(),
      revokedAt: null,
      capabilities: resolved.capabilities,
    },
  }
}

export function requireAuth(request: FastifyRequest, reply: FastifyReply): AuthContext | null {
  if (!request.auth) {
    reply.code(statusForError('UNAUTHENTICATED')).send(
      failureEnvelope('UNAUTHENTICATED', 'Authentication required', request.id),
    )
    return null
  }
  return request.auth
}

export function requireCapability(
  request: FastifyRequest,
  reply: FastifyReply,
  capability: BackendCapability,
): AuthContext | null {
  const auth = requireAuth(request, reply)
  if (!auth) return null
  if (!auth.capabilities.has(capability)) {
    reply.code(statusForError('CAPABILITY_DISABLED')).send(
      failureEnvelope('CAPABILITY_DISABLED', `Missing capability ${capability}`, request.id),
    )
    return null
  }
  return auth
}
