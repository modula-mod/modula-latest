import type {FastifyError, FastifyInstance} from 'fastify'
import {failureEnvelope, statusForError} from '../transport/envelope.js'

/**
 * Routes whose responses can carry bearer credentials or one-time secrets:
 * access/refresh tokens, in-band verification or recovery tokens, TOTP
 * provisioning secrets, recovery codes and passkey/Apple challenges.
 * RFC 6749 §5.1: such responses must not be cached (#197).
 */
const CREDENTIAL_ROUTE_PREFIXES = ['/v1/sessions', '/v1/auth/'] as const
const CREDENTIAL_ROUTES = new Set([
  '/v1/accounts/register',
  '/v1/accounts/verify-email',
  '/v1/accounts/resend-verification',
  '/v1/accounts/forgot-password',
  '/v1/accounts/reset-password',
  '/v1/accounts/recovery/request',
  '/v1/accounts/recovery/complete',
])

export function isCredentialRoute(routeUrl: string | undefined): boolean {
  if (!routeUrl) return false
  if (CREDENTIAL_ROUTES.has(routeUrl)) return true
  return CREDENTIAL_ROUTE_PREFIXES.some(prefix => routeUrl === prefix || routeUrl.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`))
}

/** Adds Cache-Control: no-store and Pragma: no-cache to every response (success or error) of a credential route. */
export function registerCredentialResponseNoStore(app: FastifyInstance): void {
  app.addHook('onSend', async (request, reply, payload) => {
    if (isCredentialRoute(request.routeOptions?.url)) {
      reply.header('Cache-Control', 'no-store')
      reply.header('Pragma', 'no-cache')
    }
    return payload
  })
}

/**
 * #198: an empty or unparseable JSON body on a credential route is answered in the
 * standard failure envelope as 400 VALIDATION_FAILED instead of Fastify's bare
 * default error body. Every other error keeps the default handling unchanged.
 */
export function registerCredentialBodyErrorEnvelope(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const bodyParseError =
      error?.statusCode === 400 &&
      ((typeof error.code === 'string' && error.code.startsWith('FST_ERR_CTP_')) || error instanceof SyntaxError)
    if (bodyParseError && isCredentialRoute(request.routeOptions?.url)) {
      return reply
        .code(statusForError('VALIDATION_FAILED'))
        .send(failureEnvelope('VALIDATION_FAILED', 'Request body must be a JSON object', request.id))
    }
    return reply.send(error)
  })
}
