import {sql} from 'kysely'
import type {AppConfig} from '../config/index.js'
import {createDb, type ModulaDb} from '../database/client.js'
import {GreenfieldEventBus} from '../events/index.js'
import {RestrictedPublisherTrustVerifier} from '../publisher/restricted-trust-verifier.js'
import {moduleError, ModuleDomainError} from './module-errors.js'
import {presentationAssetsMissingBlobs} from './presentation-blob-gaps.js'
import {GreenfieldModuleReleaseService} from './release-service.js'

export type RegistryAuthorityConfig = Pick<
  AppConfig,
  | 'databaseUrl'
  | 'trustVerifierDatabaseUrl'
  | 'publicationAuthorityDatabaseUrl'
  | 'quarantineAuthorityDatabaseUrl'
  | 'revocationAuthorityDatabaseUrl'
>

/**
 * Narrow application adapter for registry governance transitions that ordinary
 * API credentials must never perform. Each operation opens a one-connection
 * pool with its dedicated fixed-operation PostgreSQL principal and destroys it
 * immediately afterwards.
 */
export class GreenfieldRegistryAuthorityService {
  constructor(
    private readonly db: ModulaDb,
    private readonly config: RegistryAuthorityConfig,
  ) {}

  async verifyPendingSignature(releaseId: string): Promise<{
    releaseId: string
    verificationState: 'verified'
    alreadyVerified: boolean
  }> {
    const previous = await this.db.selectFrom('greenfield_module_release_signatures')
      .select('verification_state')
      .where('release_id', '=', releaseId)
      .executeTakeFirst()
    const authorityUrl = this.requireDedicatedAuthorityUrl(
      this.config.trustVerifierDatabaseUrl,
      'Registry trust verifier',
    )
    const processed = await this.withAuthority(
      authorityUrl,
      'modula-registry-trust-verifier',
      async authorityDb => new RestrictedPublisherTrustVerifier(authorityDb).verifyExternal(releaseId),
    )
    const signature = await this.db.selectFrom('greenfield_module_release_signatures')
      .select(['verification_state', 'verification_detail'])
      .where('release_id', '=', releaseId)
      .executeTakeFirst()
    if (!signature) throw moduleError('NOT_FOUND', 'Release signature evidence was not found')
    if (signature.verification_state !== 'verified') {
      // A signing-key revocation is already an authoritative block and the
      // quarantine authority deliberately refuses to replace revoked facts.
      if (signature.verification_state !== 'revokedKey') {
        await this.quarantineRelease(
          releaseId,
          signature.verification_detail ?? `Independent signature verification settled as ${signature.verification_state ?? 'invalid'}`,
          'block',
        )
      }
      throw moduleError(
        'VALIDATION_FAILED',
        `Independent registry signature verification failed (${signature.verification_state ?? 'invalid'})`,
      )
    }
    return {releaseId, verificationState: 'verified', alreadyVerified: previous?.verification_state === 'verified' || !processed}
  }

  async publishRelease(releaseId: string) {
    const release = await new GreenfieldModuleReleaseService(this.db).getReleaseById(releaseId)
    if (!release) throw moduleError('NOT_FOUND', 'Release not found')
    if (release.releaseState === 'published') {
      await this.emitReleaseStateEvents(release, 'published')
      return release
    }
    if (release.releaseState !== 'verified') {
      throw moduleError('VALIDATION_FAILED', `Release ${release.moduleId}@${release.version} cannot be published from ${release.releaseState}`)
    }
    const presentationGaps = await presentationAssetsMissingBlobs(this.db, {releaseId})
    if (presentationGaps.length) {
      throw moduleError(
        'VALIDATION_FAILED',
        `Release ${release.moduleId}@${release.version} has presentation assets without stored bytes: ${presentationGaps.map(gap => gap.path).join(', ')}`,
      )
    }

    const authorityUrl = this.requireDedicatedAuthorityUrl(
      this.config.publicationAuthorityDatabaseUrl,
      'Registry publication authority',
    )
    const publishedReleaseId = await this.withAuthority(
      authorityUrl,
      'modula-registry-publication-authority',
      async authorityDb => {
        const result = await sql<{release_id: string}>`
          SELECT greenfield_registry_publication_authority_publish(${releaseId}) AS release_id
        `.execute(authorityDb)
        return result.rows[0]?.release_id
      },
    )
    if (publishedReleaseId !== releaseId) {
      throw moduleError('CAPABILITY_UNAVAILABLE', 'Registry publication authority returned an inconsistent release')
    }
    const published = await new GreenfieldModuleReleaseService(this.db).getReleaseById(releaseId)
    if (!published || published.releaseState !== 'published') {
      throw moduleError('CAPABILITY_UNAVAILABLE', 'Registry publication authority did not complete the release transition')
    }
    await this.emitReleaseStateEvents(published, 'published')
    return published
  }

  async quarantineRelease(
    releaseId: string,
    reason: string,
    policyAction: 'warn' | 'disableExecutableContributions' | 'block' = 'block',
  ) {
    const releases = new GreenfieldModuleReleaseService(this.db)
    const release = await releases.getReleaseById(releaseId)
    if (!release) throw moduleError('NOT_FOUND', 'Release not found')
    const existing = await this.db.selectFrom('greenfield_module_quarantines')
      .select(['reason', 'policy_action'])
      .where('release_id', '=', releaseId)
      .where('lifted_at', 'is', null)
      .executeTakeFirst()
    if (existing) {
      if (existing.reason !== reason.trim() || existing.policy_action !== policyAction) {
        throw moduleError('CONFLICT', 'Release is already quarantined with different immutable authority facts')
      }
      await this.emitReleaseStateEvents(release, 'quarantined')
      return release
    }

    const authorityUrl = this.requireDedicatedAuthorityUrl(
      this.config.quarantineAuthorityDatabaseUrl,
      'Registry quarantine authority',
    )
    const quarantineId = await this.withAuthority(
      authorityUrl,
      'modula-registry-quarantine-authority',
      async authorityDb => {
        const result = await sql<{quarantine_id: string}>`
          SELECT greenfield_quarantine_authority_record(
            ${releaseId}, ${reason}, ${policyAction}
          ) AS quarantine_id
        `.execute(authorityDb)
        return result.rows[0]?.quarantine_id
      },
    )
    if (!quarantineId) throw moduleError('CAPABILITY_UNAVAILABLE', 'Registry quarantine authority did not record the transition')
    await this.db.updateTable('greenfield_module_contributions')
      .set({registration_status: policyAction === 'warn' ? 'registered' : 'quarantined', updated_at: new Date()})
      .where('release_id', '=', releaseId)
      .where('execution_required', '=', true)
      .execute()
    const quarantined = await releases.getReleaseById(releaseId)
    if (!quarantined || quarantined.releaseState !== 'quarantined') {
      throw moduleError('CAPABILITY_UNAVAILABLE', 'Registry quarantine authority did not complete the release transition')
    }
    await this.emitReleaseStateEvents(quarantined, 'quarantined')
    return quarantined
  }

  async liftReleaseQuarantine(releaseId: string, reason: string) {
    const releases = new GreenfieldModuleReleaseService(this.db)
    const release = await releases.getReleaseById(releaseId)
    if (!release) throw moduleError('NOT_FOUND', 'Release not found')
    const quarantine = await this.db.selectFrom('greenfield_module_quarantines')
      .select('quarantine_id')
      .where('release_id', '=', releaseId)
      .where('lifted_at', 'is', null)
      .orderBy('created_at', 'asc')
      .executeTakeFirst()
    if (!quarantine) return release

    const authorityUrl = this.requireDedicatedAuthorityUrl(
      this.config.quarantineAuthorityDatabaseUrl,
      'Registry quarantine authority',
    )
    await this.withAuthority(
      authorityUrl,
      'modula-registry-quarantine-authority',
      async authorityDb => sql`
        SELECT greenfield_quarantine_authority_lift(${quarantine.quarantine_id}, ${reason})
      `.execute(authorityDb),
    )
    const restored = await releases.getReleaseById(releaseId)
    if (!restored || restored.releaseState === 'quarantined') {
      throw moduleError('CAPABILITY_UNAVAILABLE', 'Registry quarantine authority did not complete the lift transition')
    }
    await this.db.updateTable('greenfield_module_contributions')
      .set({registration_status: restored.releaseState === 'published' ? 'registered' : 'declared', updated_at: new Date()})
      .where('release_id', '=', releaseId)
      .where('execution_required', '=', true)
      .where('registration_status', '=', 'quarantined')
      .execute()
    const restoredProjectionState = restored.releaseState === 'published'
      ? 'published'
      : restored.releaseState === 'verified'
        ? 'verified'
        : 'pendingReview'
    await this.emitReleaseStateEvents(restored, restoredProjectionState, `quarantine-lift:${quarantine.quarantine_id}`)
    return restored
  }

  async revokeRelease(releaseId: string, reason = 'administrative revocation') {
    const releases = new GreenfieldModuleReleaseService(this.db)
    const release = await releases.getReleaseById(releaseId)
    if (!release) throw moduleError('NOT_FOUND', 'Release not found')
    const authorityUrl = this.requireDedicatedAuthorityUrl(
      this.config.revocationAuthorityDatabaseUrl,
      'Registry revocation authority',
    )
    const revocationId = await this.withAuthority(
      authorityUrl,
      'modula-registry-revocation-authority',
      async authorityDb => {
        const result = await sql<{revocation_id: string}>`
          SELECT greenfield_revocation_authority_record(
            'release', ${releaseId}, ${release.publisherId}, ${reason}
          ) AS revocation_id
        `.execute(authorityDb)
        return result.rows[0]?.revocation_id
      },
    )
    if (!revocationId) throw moduleError('CAPABILITY_UNAVAILABLE', 'Registry revocation authority did not record the transition')
    const revoked = await releases.getReleaseById(releaseId)
    if (!revoked || revoked.releaseState !== 'revoked') {
      throw moduleError('CAPABILITY_UNAVAILABLE', 'Registry revocation authority did not complete the release transition')
    }
    await this.emitReleaseStateEvents(revoked, 'revoked')
    return revoked
  }

  private async emitReleaseStateEvents(
    release: NonNullable<Awaited<ReturnType<GreenfieldModuleReleaseService['getReleaseById']>>>,
    state: 'pendingReview' | 'published' | 'verified' | 'quarantined' | 'revoked',
    transitionKey: string = state,
  ): Promise<void> {
    const occurredAt = new Date()
    const aggregateVersion = Math.floor(occurredAt.getTime() / 1000)
    const sensitive = state === 'quarantined' || state === 'revoked'
    const events = state === 'published' || state === 'verified' || state === 'pendingReview'
      ? [
          {
            eventType: state === 'published'
              ? 'module.release.published'
              : state === 'verified'
                ? 'module.release.verified'
                : 'module.release.imported',
            aggregateType: 'moduleRelease',
            aggregateId: release.releaseId,
          },
          {eventType: 'module.updated', aggregateType: 'module', aggregateId: release.moduleId},
        ]
      : [
          {eventType: state === 'quarantined' ? 'module.release.quarantined' : 'module.release.revoked', aggregateType: 'moduleRelease', aggregateId: release.releaseId},
          {eventType: 'module.quarantined', aggregateType: 'module', aggregateId: release.moduleId},
        ]
    await this.db.transaction().execute(async trx => {
      for (const event of events) {
        await new GreenfieldEventBus(trx).publish({
          ...event,
          aggregateVersion,
          idempotencyKey: `registry-authority:${transitionKey}:${event.eventType}:${release.releaseId}`,
          visibility: 'internal',
          classification: sensitive ? 'sensitive' : 'internal',
          payload: {releaseId: release.releaseId, moduleId: release.moduleId, version: release.version, releaseState: state},
          metadata: {source: 'greenfield.registry-authority', reasonCode: sensitive ? 'administrative' : undefined},
          occurredAt,
        })
      }
    })
  }

  private requireDedicatedAuthorityUrl(value: string | null, label: string): string {
    const authorityUrl = value?.trim()
    if (!authorityUrl) throw moduleError('CAPABILITY_UNAVAILABLE', `${label} is not configured`)
    if (sameDatabasePrincipal(authorityUrl, this.config.databaseUrl)) {
      throw moduleError('CAPABILITY_UNAVAILABLE', `${label} requires dedicated database credentials`)
    }
    return authorityUrl
  }

  private async withAuthority<T>(
    authorityUrl: string,
    applicationName: string,
    operation: (authorityDb: ModulaDb) => Promise<T>,
  ): Promise<T> {
    let authorityDb: ModulaDb | null = null
    let failed = false
    try {
      authorityDb = createDb(authorityUrl, undefined, {max: 1, applicationName})
      return await operation(authorityDb)
    } catch (error) {
      failed = true
      if (error instanceof ModuleDomainError) throw error
      throw registryAuthorityError(error)
    } finally {
      if (authorityDb) {
        try {
          await authorityDb.destroy()
        } catch {
          if (!failed) throw moduleError('CAPABILITY_UNAVAILABLE', 'Registry authority connection could not be released')
        }
      }
    }
  }
}

function sameDatabasePrincipal(left: string, right: string): boolean {
  const leftPrincipal = databasePrincipal(left)
  const rightPrincipal = databasePrincipal(right)
  return !leftPrincipal || !rightPrincipal || leftPrincipal === rightPrincipal
}

function databasePrincipal(value: string): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') return null
    return [
      url.hostname.toLowerCase(),
      url.port || '5432',
      url.pathname,
      decodeURIComponent(url.username),
    ].join('\n')
  } catch {
    return null
  }
}

function registryAuthorityError(error: unknown): Error {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as {code?: unknown}).code ?? '')
    : ''
  if (code === 'P0002') return moduleError('NOT_FOUND', 'Registry authority target was not found')
  if (code === '22023' || code === '23514' || code === '22P02') {
    return moduleError('VALIDATION_FAILED', 'Registry authority transition facts are invalid')
  }
  if (code === '42501') return moduleError('FORBIDDEN', 'Registry authority rejected the requested transition')
  if (code === '23505') return moduleError('CONFLICT', 'Registry authority transition conflicts with immutable facts')
  return moduleError('CAPABILITY_UNAVAILABLE', 'Registry authority is unavailable')
}
