import type {FastifyInstance} from 'fastify'

import type {AppConfig} from '../config/env.js'
import type {ModulaDb} from '../database/client.js'
import {MolibooGenesisService} from '../domains/moliboo-genesis/service.js'
import {requireCapability} from '../security/auth-context.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'

function mapError(reply: any, error: any, requestId: string, fallback: string) {
  const code = error && typeof error === 'object' && 'code' in error ? String((error as any).code) : 'SERVER_ERROR'
  const allowed = new Set(['VALIDATION_FAILED', 'NOT_FOUND', 'CONFLICT', 'FORBIDDEN'])
  const publicCode = allowed.has(code) ? code : 'SERVER_ERROR'
  return reply.code(statusForError(publicCode as any)).send(failureEnvelope(publicCode as any,
    publicCode === 'SERVER_ERROR' ? fallback : error instanceof Error ? error.message : fallback, requestId))
}

const certificateIdParam = {type: 'string', pattern: '^MLB-CERT-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'}

/**
 * MOLIBOO-GENESIS-01. Birth, naming and certification of a Personal
 * Moliboo. One companion per account, ever; non-transferable.
 *
 * * GET /v1/me/moliboo/genesis also backfills: an account born before
 *   Genesis shipped gets its companion on first read, idempotently.
 *   Registration itself births the companion best-effort (see
 *   AccountService.register) and never fails because Genesis did.
 * * The public verification route returns registry facts only — never the
 *   companion's name, never the account, never private memory.
 * * The admin signature route only ACCEPTS a signature made elsewhere
 *   (offline, on Andrei's Mac) and verifies it against the registered
 *   public key. The server cannot create a signature.
 */
export async function registerMolibooGenesisRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  options: {feedConfig: Record<string, any>; writeConfig: Record<string, any>},
): Promise<void> {
  const genesis = new MolibooGenesisService(db)
  const read = (extra: Record<string, any> = {}) => ({...options.feedConfig, ...extra})
  const write = (extra: Record<string, any> = {}) => ({...options.writeConfig, ...extra})
  const handle = (
    cap: 'social:read' | 'profile:customize' | 'admin:ops',
    fallback: string,
    fn: (accountId: string, request: any) => Promise<unknown>,
    status = 200,
  ) =>
    async (request: any, reply: any) => {
      const auth = requireCapability(request, reply, cap)
      if (!auth) return
      try {
        return reply.code(status).send(successEnvelope(await fn(auth.accountId, request), request.id))
      } catch (error) {
        return mapError(reply, error, request.id, fallback)
      }
    }

  app.get('/v1/me/moliboo/genesis', read(), handle('social:read', 'Unable to load your Moliboo', async accountId => {
    const {companion, created} = await genesis.ensureGenesisForAccount(accountId)
    return {
      ...companion,
      reveal: {isNew: created, bornAt: companion.bornAt, certificateRegistryId: companion.certificate.registryId},
    }
  }))

  app.post('/v1/me/moliboo/genesis/name', write({
    schema: {
      body: {
        type: 'object', additionalProperties: false, required: ['name'],
        properties: {name: {type: 'string', minLength: 1, maxLength: 80}},
      },
    },
  }), handle('profile:customize', 'Unable to name your Moliboo', (accountId, request) =>
    genesis.nameCompanion(accountId, (request.body as any)?.name)))

  app.get('/v1/me/moliboo/certificates', read(), handle('social:read', 'Unable to load your certificates', accountId =>
    genesis.listCertificatesForAccount(accountId).then(certificates => ({certificates}))))

  // Public verification (QR-code target). No auth: a certificate proves
  // itself from its registry facts, hash and signature state.
  app.get('/v1/moliboos/certificates/:certificateId', read({
    schema: {
      params: {
        type: 'object', additionalProperties: false, required: ['certificateId'],
        properties: {certificateId: certificateIdParam},
      },
    },
  }), async (request, reply) => {
    try {
      const {certificateId} = request.params as {certificateId: string}
      return reply.send(successEnvelope(await genesis.verifyCertificateByRegistryId(certificateId), request.id))
    } catch (error) {
      return mapError(reply, error, request.id, 'Unable to verify certificate')
    }
  })

  app.post('/v1/admin/moliboo/certificates/:certificateId/signature', write({
    schema: {
      params: {
        type: 'object', additionalProperties: false, required: ['certificateId'],
        properties: {certificateId: certificateIdParam},
      },
      body: {
        type: 'object', additionalProperties: false, required: ['signature', 'keyId'],
        properties: {
          signature: {type: 'string', pattern: '^[A-Za-z0-9_-]{86}$'},
          keyId: {type: 'string', minLength: 1, maxLength: 128},
        },
      },
    },
  }), handle('admin:ops', 'Unable to apply certificate signature', (accountId, request) =>
    genesis.applySignature({
      certificateRegistryId: (request.params as {certificateId: string}).certificateId,
      signature: (request.body as any)?.signature,
      keyId: (request.body as any)?.keyId,
    })))
}
