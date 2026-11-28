import {randomUUID} from 'node:crypto'
import {Readable} from 'node:stream'
import type {FastifyInstance, FastifyReply, FastifyRequest} from 'fastify'
import {sql} from 'kysely'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {moduleError} from '../modules/module-errors.js'
import {GreenfieldModulePublisherService} from '../modules/publisher-service.js'
import {GreenfieldPublisherSigningKeyService} from '../modules/release-signing.js'
import type {GreenfieldSessionService} from '../sessions/service.js'
import {failureEnvelope, statusForError, successEnvelope} from '../transport/envelope.js'
import {
  nodusModelManifest,
  nodusModelManifestBytes,
  nodusModelManifestSha256,
  nodusReleaseDescriptorV2Problem,
  parseNodusReleaseDescriptorV2,
  validNodusModelOriginUrl,
  type NodusReleaseDescriptorV2,
} from './nodus-release-descriptor.js'

/**
 * Nodus model releases — the versioned, signed release registry behind the
 * model-as-patch pipeline (migration 103).
 *
 * The server is the release registry, not the file host. Descriptors,
 * manifests, signatures and publication state live in the database; model
 * bytes live on the artifact origin and are proxied resumably to the device.
 * The server never signs: the Ed25519 manifest signature is supplied at
 * draft creation, made offline by whoever holds the private key, and the
 * server only verifies it against a registered ACTIVE publisher key.
 *
 * Publication state machine: draft -> published -> superseded (on the next
 * publish) or deprecated (on a rollback of the published row). Rollback
 * republishes a previous version; rows are never deleted. At most one
 * published release per platform (partial unique index).
 */

export const NODUS_MODEL_PUBLISHER_ID = 'modula'
export const NODUS_MODEL_PLATFORM = 'ios'

export type NodusModelReleaseStatus = 'draft' | 'published' | 'superseded' | 'deprecated'

export type NodusModelReleaseRow = {
  id: string
  platform: string
  version: string
  releaseNumber: number
  status: NodusModelReleaseStatus
  descriptor: NodusReleaseDescriptorV2
  manifestSha256: string
  originUrl: string
  publishedAt: Date | null
  supersedesVersion: string | null
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}

export type NodusModelReleasePublicItem = {
  version: string
  releaseNumber: number
  publishedAt: string | null
  nodusVersion: string
}

export type NodusModelReleaseAdminView = NodusModelReleaseRow & {
  publishedAtIso: string | null
  signature: {
    keyId: string
    verificationState: string
    fingerprint: string | null
    observedAt: string
  } | null
}

type DbRow = {
  id: string
  platform: string
  version: string
  release_number: number
  status: NodusModelReleaseStatus
  descriptor: unknown
  manifest_sha256: string
  origin_url: string
  published_at: Date | null
  supersedes_version: string | null
  created_by: string | null
  created_at: Date
  updated_at: Date
}

/** Transaction-scoped advisory lock serialising Nodus release writers. */
const NODUS_MODEL_RELEASE_LOCK_KEY = 7_314_202_610_15

const VERSION_PATTERN = /^[A-Za-z0-9._-]{1,64}$/

function rowToRelease(row: DbRow): NodusModelReleaseRow {
  return {
    id: row.id,
    platform: row.platform,
    version: row.version,
    releaseNumber: row.release_number,
    status: row.status,
    descriptor: row.descriptor as NodusReleaseDescriptorV2,
    manifestSha256: row.manifest_sha256,
    originUrl: row.origin_url,
    publishedAt: row.published_at,
    supersedesVersion: row.supersedes_version,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function publicItem(row: NodusModelReleaseRow): NodusModelReleasePublicItem {
  return {
    version: row.version,
    releaseNumber: row.releaseNumber,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    nodusVersion: row.descriptor.nodusVersion,
  }
}

export interface NodusModelReleaseStore {
  findPublished(platform: string): Promise<NodusReleaseDescriptorV2 | null>
  findByVersion(platform: string, version: string): Promise<NodusModelReleaseRow | null>
  listPublished(platform: string): Promise<NodusModelReleaseRow[]>
  listAll(platform: string): Promise<NodusModelReleaseRow[]>
}

export function createNodusModelReleaseStore(db: ModulaDb): NodusModelReleaseStore {
  return new NodusModelReleaseStoreImpl(db)
}

class NodusModelReleaseStoreImpl implements NodusModelReleaseStore {
  constructor(private readonly db: ModulaDb) {}

  /**
   * The published descriptor for a platform, or null. If the registry tables
   * do not exist yet (code deployed before migration 103 runs), returns null
   * so /latest falls back to the env descriptor exactly as before.
   */
  async findPublished(platform: string): Promise<NodusReleaseDescriptorV2 | null> {
    try {
      const row = await this.db
        .selectFrom('greenfield_nodus_model_releases')
        .selectAll()
        .where('platform', '=', platform)
        .where('status', '=', 'published')
        .executeTakeFirst()
      return row ? (row.descriptor as NodusReleaseDescriptorV2) : null
    } catch (error) {
      if ((error as {code?: string})?.code === '42P01') return null
      throw error
    }
  }

  async findByVersion(platform: string, version: string): Promise<NodusModelReleaseRow | null> {
    const row = await this.db
      .selectFrom('greenfield_nodus_model_releases')
      .selectAll()
      .where('platform', '=', platform)
      .where('version', '=', version)
      .executeTakeFirst()
    return row ? rowToRelease(row as DbRow) : null
  }

  async listPublished(platform: string): Promise<NodusModelReleaseRow[]> {
    const rows = await this.db
      .selectFrom('greenfield_nodus_model_releases')
      .selectAll()
      .where('platform', '=', platform)
      .where('status', '=', 'published')
      .orderBy('release_number', 'desc')
      .execute()
    return rows.map(row => rowToRelease(row as DbRow))
  }

  async listAll(platform: string): Promise<NodusModelReleaseRow[]> {
    const rows = await this.db
      .selectFrom('greenfield_nodus_model_releases')
      .selectAll()
      .where('platform', '=', platform)
      .orderBy('release_number', 'desc')
      .execute()
    return rows.map(row => rowToRelease(row as DbRow))
  }
}

export class NodusModelReleaseService {
  private readonly store: NodusModelReleaseStoreImpl
  private readonly signingKeys: GreenfieldPublisherSigningKeyService

  constructor(private readonly db: ModulaDb) {
    this.store = new NodusModelReleaseStoreImpl(db)
    this.signingKeys = new GreenfieldPublisherSigningKeyService(db)
  }

  get releaseStore(): NodusModelReleaseStore {
    return this.store
  }

  async findPublished(platform: string): Promise<NodusReleaseDescriptorV2 | null> {
    return this.store.findPublished(platform)
  }

  /**
   * Creates a draft release from a v2 descriptor body. Fail-closed:
   * (1) descriptor shape validated; (2) the descriptor's manifest hash must
   * equal the canonical manifest hash (the descriptor must be
   * self-consistent); (3) the manifest signature must verify against a
   * registered ACTIVE key for the first-party publisher, observed now;
   * (4) the version must be unused for this platform. The signature is
   * supplied, never made here.
   */
  async createDraft(input: {
    descriptorRaw: string
    originUrl: unknown
    actorAccountId: string | null
    publicApiUrl: string
  }): Promise<NodusModelReleaseRow> {
    const problem = nodusReleaseDescriptorV2Problem(input.descriptorRaw)
    if (problem !== null) throw moduleError('VALIDATION_FAILED', `Invalid Nodus release descriptor: ${problem}`)
    const descriptor = parseNodusReleaseDescriptorV2(input.descriptorRaw)!
    if (!validNodusModelOriginUrl(input.originUrl)) {
      throw moduleError('VALIDATION_FAILED', 'originUrl must be an https URL without userinfo (loopback http is allowed for test origins only)')
    }
    const originUrl = input.originUrl as string
    if (nodusModelManifestSha256(descriptor) !== descriptor.manifestSHA256) {
      throw moduleError('VALIDATION_FAILED', 'manifestSHA256 does not match the canonical manifest for this descriptor')
    }
    const expectedManifestUrl = `${input.publicApiUrl.replace(/\/$/, '')}/v1/intelligence/nodus/releases/${descriptor.nodusVersion}/manifest`
    if (descriptor.manifestURL !== expectedManifestUrl) {
      throw moduleError('VALIDATION_FAILED', 'manifestURL must be this server\u2019s manifest endpoint for the release version')
    }
    for (const file of descriptor.files) {
      const expectedFileUrl = `${input.publicApiUrl.replace(/\/$/, '')}/v1/intelligence/nodus/releases/${descriptor.nodusVersion}/files/${file.path}`
      if (file.url !== expectedFileUrl) {
        throw moduleError('VALIDATION_FAILED', `files[${file.path}].url must be this server\u2019s file endpoint for the release version`)
      }
    }
    const observedAt = new Date()
    const key = await this.db
      .selectFrom('greenfield_publisher_signing_keys')
      .select(['key_id', 'state'])
      .where('key_id', '=', descriptor.signingKeyId)
      .executeTakeFirst()
    if (!key || key.state !== 'ACTIVE') {
      throw moduleError('VALIDATION_FAILED', `Signing key ${descriptor.signingKeyId} is not a registered ACTIVE publisher key`)
    }
    const verification = await this.signingKeys.verifyCanonicalStatement(
      nodusModelManifest(descriptor),
      NODUS_MODEL_PUBLISHER_ID,
      {algorithm: 'Ed25519', keyId: descriptor.signingKeyId, value: descriptor.signature},
      observedAt,
    )
    if (verification.state !== 'verified') {
      throw moduleError('VALIDATION_FAILED', `Manifest signature did not verify (${verification.state}): ${verification.detail}`)
    }
    const release = await this.db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(${NODUS_MODEL_RELEASE_LOCK_KEY})`.execute(trx)
      const existing = await trx
        .selectFrom('greenfield_nodus_model_releases')
        .select(['id'])
        .where('platform', '=', NODUS_MODEL_PLATFORM)
        .where('version', '=', descriptor.nodusVersion)
        .executeTakeFirst()
      if (existing) throw moduleError('CONFLICT', `A Nodus release already exists for version ${descriptor.nodusVersion}`)
      const maxRow = await trx
        .selectFrom('greenfield_nodus_model_releases')
        .select(({fn}) => fn.max('release_number').as('max'))
        .where('platform', '=', NODUS_MODEL_PLATFORM)
        .executeTakeFirst()
      const releaseNumber = Number(maxRow?.max ?? 0) + 1
      if (releaseNumber !== descriptor.releaseNumber) {
        throw moduleError('VALIDATION_FAILED', `releaseNumber must be ${releaseNumber} (the next number for this platform)`)
      }
      const now = new Date()
      const releaseId = randomUUID()
      await trx
        .insertInto('greenfield_nodus_model_releases')
        .values({
          id: releaseId,
          platform: NODUS_MODEL_PLATFORM,
          version: descriptor.nodusVersion,
          release_number: releaseNumber,
          status: 'draft',
          descriptor: sql`${JSON.stringify(descriptor)}::jsonb`,
          manifest_sha256: descriptor.manifestSHA256,
          origin_url: originUrl,
          published_at: null,
          supersedes_version: descriptor.supersedes,
          created_by: input.actorAccountId,
          created_at: now,
          updated_at: now,
        })
        .execute()
      await trx
        .insertInto('greenfield_nodus_model_release_signatures')
        .values({
          signature_id: randomUUID(),
          release_id: releaseId,
          signature_key_id: descriptor.signingKeyId,
          signature: descriptor.signature,
          algorithm: 'Ed25519',
          statement: sql`${JSON.stringify(nodusModelManifest(descriptor))}::jsonb`,
          statement_sha256: verification.statementSha256,
          verification_state: 'verified',
          verification_detail: verification.detail,
          public_key_fingerprint: verification.publicKeyFingerprint,
          observed_at: observedAt,
          created_at: now,
        })
        .execute()
      const created = await trx
        .selectFrom('greenfield_nodus_model_releases')
        .selectAll()
        .where('id', '=', releaseId)
        .executeTakeFirstOrThrow()
      return rowToRelease(created as DbRow)
    })
    return release
  }

  /**
   * Publishes a draft: the currently-published release (if any) becomes
   * superseded and the draft becomes published with published_at = now.
   * One transaction; the partial unique index keeps at most one published
   * release per platform even under a race.
   */
  async publish(platform: string, version: string): Promise<NodusModelReleaseRow> {
    return this.db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(${NODUS_MODEL_RELEASE_LOCK_KEY})`.execute(trx)
      const draft = await trx
        .selectFrom('greenfield_nodus_model_releases')
        .selectAll()
        .where('platform', '=', platform)
        .where('version', '=', version)
        .executeTakeFirst()
      if (!draft) throw moduleError('NOT_FOUND', `No Nodus release exists for version ${version}`)
      if (draft.status !== 'draft') throw moduleError('CONFLICT', `Only a draft can be published (version ${version} is ${draft.status})`)
      const current = await trx
        .selectFrom('greenfield_nodus_model_releases')
        .selectAll()
        .where('platform', '=', platform)
        .where('status', '=', 'published')
        .executeTakeFirst()
      const now = new Date()
      if (current) {
        await trx
          .updateTable('greenfield_nodus_model_releases')
          .set({status: 'superseded', updated_at: now})
          .where('id', '=', current.id)
          .execute()
      }
      const publishedDescriptor = {
        ...(draft.descriptor as NodusReleaseDescriptorV2),
        publishedAt: now.toISOString(),
        supersedes: current ? (current.version as string) : null,
      }
      await trx
        .updateTable('greenfield_nodus_model_releases')
        .set({
          status: 'published',
          descriptor: sql`${JSON.stringify(publishedDescriptor)}::jsonb`,
          published_at: now,
          supersedes_version: current ? (current.version as string) : null,
          updated_at: now,
        })
        .where('id', '=', draft.id)
        .execute()
      const updated = await trx
        .selectFrom('greenfield_nodus_model_releases')
        .selectAll()
        .where('id', '=', draft.id)
        .executeTakeFirstOrThrow()
      return rowToRelease(updated as DbRow)
    })
  }

  /**
   * Republishes a previously published version: the named version (must be
   * published or superseded) becomes published again with a fresh
   * published_at; the currently-published version becomes deprecated. The
   * bad version is never deleted. Clients whose installed version is newer
   * than latest downgrade to this version.
   */
  async rollback(platform: string, version: string): Promise<NodusModelReleaseRow> {
    return this.db.transaction().execute(async trx => {
      await sql`SELECT pg_advisory_xact_lock(${NODUS_MODEL_RELEASE_LOCK_KEY})`.execute(trx)
      const target = await trx
        .selectFrom('greenfield_nodus_model_releases')
        .selectAll()
        .where('platform', '=', platform)
        .where('version', '=', version)
        .executeTakeFirst()
      if (!target) throw moduleError('NOT_FOUND', `No Nodus release exists for version ${version}`)
      if (target.status !== 'published' && target.status !== 'superseded') {
        throw moduleError('CONFLICT', `Only a published or superseded version can be rolled back to (version ${version} is ${target.status})`)
      }
      const now = new Date()
      const current = await trx
        .selectFrom('greenfield_nodus_model_releases')
        .selectAll()
        .where('platform', '=', platform)
        .where('status', '=', 'published')
        .executeTakeFirst()
      if (current && current.id !== target.id) {
        await trx
          .updateTable('greenfield_nodus_model_releases')
          .set({status: 'deprecated', updated_at: now})
          .where('id', '=', current.id)
          .execute()
      }
      const republishedDescriptor = {
        ...(target.descriptor as NodusReleaseDescriptorV2),
        publishedAt: now.toISOString(),
      }
      await trx
        .updateTable('greenfield_nodus_model_releases')
        .set({
          status: 'published',
          descriptor: sql`${JSON.stringify(republishedDescriptor)}::jsonb`,
          published_at: now,
          updated_at: now,
        })
        .where('id', '=', target.id)
        .execute()
      const updated = await trx
        .selectFrom('greenfield_nodus_model_releases')
        .selectAll()
        .where('id', '=', target.id)
        .executeTakeFirstOrThrow()
      return rowToRelease(updated as DbRow)
    })
  }

  async adminView(row: NodusModelReleaseRow): Promise<NodusModelReleaseAdminView> {
    const signature = await this.db
      .selectFrom('greenfield_nodus_model_release_signatures')
      .selectAll()
      .where('release_id', '=', row.id)
      .orderBy('observed_at', 'desc')
      .executeTakeFirst()
    return {
      ...row,
      publishedAtIso: row.publishedAt?.toISOString() ?? null,
      signature: signature
        ? {
            keyId: signature.signature_key_id,
            verificationState: signature.verification_state,
            fingerprint: signature.public_key_fingerprint,
            observedAt: (signature.observed_at as Date).toISOString(),
          }
        : null,
    }
  }

  async listAdmin(platform: string): Promise<NodusModelReleaseAdminView[]> {
    const rows = await this.store.listAll(platform)
    return Promise.all(rows.map(row => this.adminView(row)))
  }
}

/* ------------------------------------------------------------------ */
/* Routes                                                              */
/* ------------------------------------------------------------------ */

type RouteConfig = Record<string, unknown>

function bearerToken(request: FastifyRequest): string {
  const rawHeader = request.headers.authorization
  const header = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : ''
}

function sendError(reply: FastifyReply, code: any, message: string, requestId: string) {
  return reply.code(statusForError(code)).send(failureEnvelope(code, message, requestId))
}

function sendMapped(reply: FastifyReply, error: unknown, requestId: string, fallback: string) {
  const code = error && typeof error === 'object' && 'code' in error ? (error as any).code : 'SERVER_ERROR'
  if (['VALIDATION_FAILED', 'NOT_FOUND', 'FORBIDDEN', 'CONFLICT', 'UNAUTHENTICATED'].includes(code)) {
    return sendError(reply, code, error instanceof Error ? error.message : fallback, requestId)
  }
  return sendError(reply, 'SERVER_ERROR', fallback, requestId)
}

async function requireGreenfieldAuth(request: FastifyRequest, reply: FastifyReply, sessions: GreenfieldSessionService) {
  const token = bearerToken(request)
  const auth = token ? await sessions.resolveAccess(token) : null
  if (!auth) {
    sendError(reply, 'UNAUTHENTICATED', 'Authentication required', request.id)
    return null
  }
  return auth
}

/**
 * Admin = allowlisted handle (MODULA_ADMIN_HANDLES), not a role column —
 * the same per-route pattern as the AI admin routes. There is no global
 * admin middleware in this repo.
 */
function adminAction(
  sessions: GreenfieldSessionService,
  publishers: GreenfieldModulePublisherService,
  action: (request: FastifyRequest) => Promise<unknown>,
  statusCode = 200,
) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const auth = await requireGreenfieldAuth(request, reply, sessions)
    if (!auth) return
    try {
      await publishers.requireAdminAccount(auth.accountId)
      ;(request as any).auth = auth
      return reply.code(statusCode).send(successEnvelope(await action(request), request.id))
    } catch (error) {
      return sendMapped(reply, error, request.id, 'Administrative Nodus release action failed')
    }
  }
}

/**
 * Single-range parsing with the exact semantics of the module-artifact
 * download handler (src/modules/routes/index.ts): `bytes=start-end`,
 * open-ended and suffix forms, 416 on anything unsatisfiable.
 */
function parseSingleRange(value: string, size: number): {start: number; end: number} | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim())
  if (!match || (!match[1] && !match[2]) || size <= 0) return null
  if (!match[1]) {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return null
    return {start: Math.max(0, size - suffix), end: size - 1}
  }
  const start = Number(match[1])
  const end = match[2] ? Number(match[2]) : size - 1
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) return null
  return {start, end: Math.min(end, size - 1)}
}

function ifNoneMatch(header: string | string[] | undefined, etag: string): boolean {
  if (!header) return false
  const values = Array.isArray(header) ? header : [header]
  return values.some(value => value.split(',').map(part => part.trim()).includes(etag) || value.trim() === '*')
}

/** Yields only bytes [start, end] of a full-file upstream body. */
async function* sliceStream(body: AsyncIterable<Uint8Array>, start: number, end: number): AsyncGenerator<Buffer> {
  let offset = 0
  for await (const chunk of body) {
    const buf = Buffer.from(chunk)
    const chunkStart = offset
    const chunkEnd = offset + buf.length - 1
    offset += buf.length
    if (chunkEnd < start) continue
    if (chunkStart > end) break
    const sliceStart = Math.max(0, start - chunkStart)
    const sliceEnd = Math.min(buf.length - 1, end - chunkStart)
    yield buf.subarray(sliceStart, sliceEnd + 1)
    if (chunkEnd >= end) break
  }
}

function validVersionParam(value: unknown): value is string {
  return typeof value === 'string' && VERSION_PATTERN.test(value)
}

export async function registerNodusModelReleaseRoutes(
  app: FastifyInstance,
  db: ModulaDb,
  config: AppConfig,
  sessions: GreenfieldSessionService,
  routeConfig: {feedConfig: RouteConfig; profileConfig: RouteConfig; writeConfig: RouteConfig},
): Promise<void> {
  const service = new NodusModelReleaseService(db)
  const publishers = new GreenfieldModulePublisherService(db, config)
  const publicApiUrl = config.publicApiUrl.replace(/\/$/, '')
  const notFound = (reply: FastifyReply, message: string, requestId: string) =>
    reply.code(statusForError('NOT_FOUND')).send(failureEnvelope('NOT_FOUND', message, requestId))

  async function findServableRelease(version: string): Promise<NodusModelReleaseRow | null> {
    const row = await service.releaseStore.findByVersion(NODUS_MODEL_PLATFORM, version)
    if (!row || (row.status !== 'published' && row.status !== 'superseded')) return null
    return row
  }

  app.get('/v1/intelligence/nodus/releases', {
    ...routeConfig.feedConfig,
    schema: {
      querystring: {
        type: 'object',
        properties: {
          platform: {type: 'string', minLength: 1, maxLength: 32},
        },
      },
    },
  }, async (request, reply) => {
    const {platform = 'ios'} = (request.query ?? {}) as {platform?: string}
    reply.header('cache-control', 'no-store')
    if (platform !== NODUS_MODEL_PLATFORM) return notFound(reply, 'No Nodus releases are available', request.id)
    const rows = await service.releaseStore.listPublished(platform)
    // Raw JSON list, no envelope — same convention as /latest.
    return reply.send(rows.map(row => publicItem(row)))
  })

  app.get('/v1/intelligence/nodus/releases/:version', routeConfig.feedConfig, async (request, reply) => {
    const {version} = (request.params ?? {}) as {version?: string}
    reply.header('cache-control', 'no-store')
    if (!validVersionParam(version) || version === 'latest') return notFound(reply, 'Nodus release not found', request.id)
    const row = await findServableRelease(version)
    if (!row) return notFound(reply, 'Nodus release not found', request.id)
    // Raw JSON, no envelope — the v2 descriptor the client decodes directly.
    return reply.send(row.descriptor)
  })

  app.get('/v1/intelligence/nodus/releases/:version/manifest', routeConfig.feedConfig, async (request, reply) => {
    const {version} = (request.params ?? {}) as {version?: string}
    if (!validVersionParam(version) || version === 'latest') return notFound(reply, 'Nodus release not found', request.id)
    const row = await findServableRelease(version)
    if (!row) return notFound(reply, 'Nodus release not found', request.id)
    // The manifest is immutable per version: the exact canonical bytes the
    // signature covers. ETag carries the manifest SHA-256.
    const etag = `"sha256-${row.manifestSha256}"`
    reply
      .header('ETag', etag)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .type('application/json')
    if (ifNoneMatch(request.headers['if-none-match'], etag)) return reply.code(304).send()
    const manifestBytes = nodusModelManifestBytes(row.descriptor)
    return reply.header('Content-Length', String(manifestBytes.length)).send(manifestBytes)
  })

  app.get('/v1/intelligence/nodus/releases/:version/files/*', routeConfig.feedConfig, async (request, reply) => {
    const {version} = (request.params ?? {}) as {version?: string}
    const filePath = (request.params as {'*': string})['*']
    if (!validVersionParam(version) || version === 'latest') return notFound(reply, 'Nodus release not found', request.id)
    const row = await findServableRelease(version)
    if (!row) return notFound(reply, 'Nodus release not found', request.id)
    const file = row.descriptor.files.find(entry => entry.path === filePath)
    if (!file) return notFound(reply, 'Nodus model file not found', request.id)
    const etag = `"sha256-${file.sha256}"`
    reply
      .header('ETag', etag)
      .header('Accept-Ranges', 'bytes')
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .header('X-Content-Type-Options', 'nosniff')
      .header('X-Modula-Artifact-Sha256', file.sha256)
      .header('Content-Disposition', `attachment; filename="${file.path.split('/').at(-1)}"`)
      .type('application/octet-stream')
    if (ifNoneMatch(request.headers['if-none-match'], etag) && !request.headers.range) return reply.code(304).send()
    const range = request.headers.range
    const ifRange = request.headers['if-range']
    const parsed = range && (!ifRange || ifRange === etag) ? parseSingleRange(range, file.bytes) : null
    if (range && (!ifRange || ifRange === etag) && !parsed) {
      return reply.header('Content-Range', `bytes */${file.bytes}`).code(416).send()
    }
    // The proxy is deliberately dumb about verification: it cannot check a
    // partial range against a full-file hash. The client's per-file SHA-256
    // check after download is the guarantee.
    const upstreamUrl = `${row.originUrl.replace(/\/$/, '')}/${file.path}`
    let upstream: Response
    try {
      upstream = await fetch(upstreamUrl, {
        headers: parsed ? {Range: `bytes=${parsed.start}-${parsed.end}`} : {},
      })
    } catch {
      return sendError(reply, 'SERVER_ERROR', 'Model artifact origin is unavailable', request.id)
    }
    if (upstream.status === 404 || upstream.status === 410) return notFound(reply, 'Nodus model file not found', request.id)
    if (upstream.status !== 200 && upstream.status !== 206) {
      return sendError(reply, 'SERVER_ERROR', 'Model artifact origin is unavailable', request.id)
    }
    if (!upstream.body) return sendError(reply, 'SERVER_ERROR', 'Model artifact origin returned an empty body', request.id)
    if (parsed) {
      if (upstream.status === 206) {
        // The origin honoured the range: stream its body as-is.
        return reply
          .header('Content-Range', `bytes ${parsed.start}-${parsed.end}/${file.bytes}`)
          .header('Content-Length', String(parsed.end - parsed.start + 1))
          .code(206)
          .send(Readable.from(upstream.body as AsyncIterable<Uint8Array>))
      }
      // A dumb origin answered 200: skip to the range start and cap at the
      // range end while streaming, so resume works regardless of the origin.
      return reply
        .header('Content-Range', `bytes ${parsed.start}-${parsed.end}/${file.bytes}`)
        .header('Content-Length', String(parsed.end - parsed.start + 1))
        .code(206)
        .send(Readable.from(sliceStream(upstream.body as AsyncIterable<Uint8Array>, parsed.start, parsed.end)))
    }
    return reply.header('Content-Length', String(file.bytes)).send(Readable.from(upstream.body as AsyncIterable<Uint8Array>))
  })

  app.get('/v1/admin/intelligence/nodus/releases', routeConfig.profileConfig, adminAction(sessions, publishers, async request => {
    const {platform = 'ios'} = (request.query ?? {}) as {platform?: string}
    if (platform !== NODUS_MODEL_PLATFORM) throw moduleError('NOT_FOUND', 'No Nodus releases are available')
    return service.listAdmin(platform)
  }))

  app.post('/v1/admin/intelligence/nodus/releases', routeConfig.writeConfig, adminAction(sessions, publishers, async request => {
    const body = (request.body ?? {}) as {descriptor?: unknown; originUrl?: unknown}
    if (!body.descriptor || typeof body.descriptor !== 'object' || Array.isArray(body.descriptor)) {
      throw moduleError('VALIDATION_FAILED', 'descriptor must be a v2 Nodus release descriptor object')
    }
    const created = await service.createDraft({
      descriptorRaw: JSON.stringify(body.descriptor),
      originUrl: body.originUrl,
      actorAccountId: (request as any).auth?.accountId ?? null,
      publicApiUrl,
    })
    return service.adminView(created)
  }, 201))

  app.post('/v1/admin/intelligence/nodus/releases/:version/publish', routeConfig.writeConfig, adminAction(sessions, publishers, async request => {
    const {version} = (request.params ?? {}) as {version?: string}
    if (!validVersionParam(version)) throw moduleError('VALIDATION_FAILED', 'Invalid release version')
    const published = await service.publish(NODUS_MODEL_PLATFORM, version)
    return service.adminView(published)
  }))

  app.post('/v1/admin/intelligence/nodus/releases/:version/rollback', routeConfig.writeConfig, adminAction(sessions, publishers, async request => {
    const {version} = (request.params ?? {}) as {version?: string}
    if (!validVersionParam(version)) throw moduleError('VALIDATION_FAILED', 'Invalid release version')
    const republished = await service.rollback(NODUS_MODEL_PLATFORM, version)
    return service.adminView(republished)
  }))
}
