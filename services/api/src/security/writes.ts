import type {FastifyReply, FastifyRequest} from 'fastify'
import {failureEnvelope, statusForError} from '../transport/envelope.js'

export async function denyWrite(_request: FastifyRequest, reply: FastifyReply) {
  const requestId = reply.request.id
  const body = failureEnvelope(
    'AUTHENTICATION_NOT_AVAILABLE',
    'Production authentication and mutations are not available yet.',
    requestId,
  )
  return reply.code(statusForError('AUTHENTICATION_NOT_AVAILABLE')).send(body)
}
