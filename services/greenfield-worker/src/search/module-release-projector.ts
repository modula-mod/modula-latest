import type {GreenfieldSearchDocument} from '@modula/greenfield-contracts'
import type {ModulaWorkerDb} from '../database.js'
import {entityIdFromEvent, SearchProjector, type SearchProjectionContext} from './projector.js'

export async function projectModuleRelease(db: ModulaWorkerDb, projector: SearchProjector, context: SearchProjectionContext): Promise<void> {
  const releaseId = entityIdFromEvent(context.event, context.event.aggregateId)
  const row = await db
    .selectFrom('greenfield_module_releases')
    .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
    .selectAll('greenfield_module_releases')
    .select('greenfield_module_versions.manifest')
    .where(({eb, or}) =>
      or([
        eb('greenfield_module_releases.release_id', '=', releaseId),
        eb('greenfield_module_releases.module_id', '=', releaseId),
      ]),
    )
    .orderBy('greenfield_module_releases.updated_at', 'desc')
    .executeTakeFirst()

  if (!row) {
    await projector.tombstone({...context, entityId: releaseId}, {
      sourceVersion: projector.sourceVersionFor(context, Date.now()),
      visibility: 'public',
      status: 'unavailable',
    })
    return
  }

  if (isGeneratedSearchFixtureModuleId(row.module_id)) {
    await projector.tombstone({...context, entityId: row.release_id}, {
      sourceVersion: projector.sourceVersionFor(context, row.updated_at.getTime()),
      visibility: 'public',
      status: 'unavailable',
    })
    return
  }

  const manifest = recordFromJson(row.manifest)
  const releaseNotes = stringField(manifest.releaseNotes) ?? stringField(recordFromJson(manifest.extensions).releaseNotes)
  const compatibility = recordFromJson(row.compatibility)
  const status = statusForRelease(row.release_state)
  const standardVersion = String(manifest.manifestVersion ?? '1')
  const document: GreenfieldSearchDocument = {
    documentId: `module-release:${row.release_id}`,
    schemaVersion: '1.0.0',
    entityType: 'module-release',
    entityId: row.release_id,
    sourceVersion: projector.sourceVersionFor(context, row.updated_at.getTime()),
    title: `${stringField(manifest.name) ?? row.module_id} ${row.version}`,
    body: [row.module_id, row.version, releaseNotes, JSON.stringify(compatibility)].filter(Boolean).join(' '),
    summary: releaseNotes ?? stringField(manifest.description),
    keywords: Array.from(new Set([row.module_id, row.version, standardVersion, row.publisher_id].filter(Boolean).map(item => item.toLowerCase()))),
    tags: [row.release_state, row.trust_level, row.license_status].map(item => item.toLowerCase()),
    visibility: 'public',
    status,
    language: 'en',
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    indexedAt: new Date().toISOString(),
    metadata: {
      moduleId: row.module_id,
      version: row.version,
      standardVersion,
      channel: stringField(recordFromJson(manifest.extensions).channel) ?? 'default',
      compatibility,
      publisher: row.publisher_id,
      trustState: row.trust_level,
      checksumState: row.release_sha256 ? 'present' : 'missing',
      releaseState: row.release_state,
    },
  }
  await projector.upsert({...context, entityId: row.release_id}, document)
}

function statusForRelease(releaseState: string): GreenfieldSearchDocument['status'] {
  if (releaseState === 'published' || releaseState === 'verified') return 'active'
  if (releaseState === 'quarantined') return 'quarantined'
  if (releaseState === 'revoked') return 'unavailable'
  return 'unavailable'
}

function recordFromJson(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function isGeneratedSearchFixtureModuleId(moduleId: string): boolean {
  return /^digital\.modula\.search-[0-9a-f]+$/i.test(moduleId)
}
