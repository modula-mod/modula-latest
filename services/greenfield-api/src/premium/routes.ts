import type {FastifyInstance} from 'fastify'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {requireAuth} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {AppleVerificationError, AppStoreJwsVerifier, appleRootCertificate, loadQaRootCertificates, type AppleJwsVerifier} from './apple-verifier.js'
import {PremiumService} from './service.js'

const KNOWN = new Set(['VALIDATION_FAILED', 'FORBIDDEN', 'CONFLICT', 'NOT_FOUND'])

function fail(reply: any, error: any, requestId: string, fallback: string) {
  const code = error instanceof AppleVerificationError ? 'VALIDATION_FAILED' : KNOWN.has(error?.code) ? error.code : 'SERVER_ERROR'
  const message = code === 'SERVER_ERROR' ? fallback : error instanceof AppleVerificationError ? error.reason : error.message
  return reply.code(statusForError(code)).send(failureEnvelope(code, message, requestId))
}

export function createAppleVerifier(config: AppConfig): AppleJwsVerifier | null {
  if (!config.premium.appleBundleId) return null
  const roots = [appleRootCertificate(), ...(config.premium.appleQaRootCertificatePath ? loadQaRootCertificates(config.premium.appleQaRootCertificatePath, config.environment) : [])]
  return new AppStoreJwsVerifier({bundleId: config.premium.appleBundleId, environment: 'Sandbox', enableOnlineChecks: config.premium.appleOnlineChecks, rootCertificates: roots})
}

/**
 * Modula Premium routes. Registered only when MODULA_PREMIUM_ENTITLEMENTS_ENABLED=true.
 * App Store verification is Sandbox-only in this phase.
 */
export async function registerPremiumRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  routeConfig: {profileConfig: Record<string, unknown>; writeConfig: Record<string, unknown>; healthConfig: Record<string, unknown>},
  verifier: AppleJwsVerifier | null = createAppleVerifier(config),
) {
  const premium = new PremiumService(db, verifier)

  app.get('/v1/me/entitlements', routeConfig.profileConfig, async (request, reply) => {
    const auth = requireAuth(request, reply)
    if (!auth) return
    try {
      return reply.send(successEnvelope(await premium.me(auth.actorId), request.id))
    } catch (error) {
      return fail(reply, error, request.id, 'Unable to load entitlements')
    }
  })

  app.post('/v1/premium/apple/transactions', routeConfig.writeConfig, async (request, reply) => {
    const auth = requireAuth(request, reply)
    if (!auth) return
    const body = (request.body ?? {}) as {signedTransaction?: unknown; jwsRepresentation?: unknown}
    try {
      return reply.send(successEnvelope(await premium.applyClientTransaction(auth.actorId, body.signedTransaction ?? body.jwsRepresentation), request.id))
    } catch (error) {
      return fail(reply, error, request.id, 'Unable to apply transaction')
    }
  })

  // App Store Server Notifications V2. Unauthenticated by design: the signed payload is the authentication.
  app.post('/v1/premium/apple/notifications', routeConfig.healthConfig, async (request, reply) => {
    try {
      return reply.send(successEnvelope(await premium.applyNotification(request.body), request.id))
    } catch (error) {
      return fail(reply, error, request.id, 'Unable to apply notification')
    }
  })

  if (config.premium.qaAdminEnabled) {
    app.put('/v1/admin/verifications/:handle', {
      ...routeConfig.writeConfig,
      schema: {params: {type: 'object', additionalProperties: false, required: ['handle'], properties: {handle: {type: 'string', minLength: 1, maxLength: 80}}}},
    }, async (request, reply) => {
      const auth = requireAuth(request, reply)
      if (!auth) return
      try {
        const account = await db.selectFrom('greenfield_accounts').select('primary_handle').where('account_id', '=', auth.accountId).executeTakeFirst()
        if (!account || !config.adminHandles.includes(account.primary_handle.toLowerCase())) throw Object.assign(new Error('Verification administration required'), {code: 'FORBIDDEN'})
        const {handle} = request.params as {handle: string}
        return reply.send(successEnvelope(await premium.setVerification(auth.actorId, handle, (request.body ?? {}) as Record<string, unknown>), request.id))
      } catch (error) {
        return fail(reply, error, request.id, 'Unable to set verification')
      }
    })
  }
}
