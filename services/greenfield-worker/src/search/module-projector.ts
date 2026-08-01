import type {GreenfieldSearchDocument} from '@modula/greenfield-contracts'
import type {ModulaWorkerDb} from '../database.js'
import {entityIdFromEvent, SearchProjector, type SearchProjectionContext} from './projector.js'

export async function projectModule(db: ModulaWorkerDb, projector: SearchProjector, context: SearchProjectionContext): Promise<void> {
  const moduleId = moduleIdFromEvent(context)
  const catalogue = await db
    .selectFrom('greenfield_extension_catalogue')
    .selectAll()
    .where('slug', '=', moduleId)
    .where('kind', '=', 'module')
    .executeTakeFirst()
  const release = await latestRelease(db, moduleId)

  if (!catalogue && !release) {
    await projector.tombstone({...context, entityId: moduleId}, {
      sourceVersion: projector.sourceVersionFor(context, Date.now()),
      visibility: 'public',
      status: 'unavailable',
    })
    return
  }

  const manifest = recordFromJson((release?.manifest ?? catalogue?.manifest) as unknown)
  const name = stringField(manifest.name) ?? catalogue?.name ?? moduleId
  const description = stringField(manifest.description) ?? catalogue?.description ?? ''
  const status = statusForModule(catalogue?.catalogue_status, release?.release_state)
  const capabilities = contributionKeys(manifest.contributions)
  const platforms = arrayOfStrings(recordFromJson(manifest.compatibility).platforms)
  const categories = arrayOfStrings(manifest.categories ?? recordFromJson(manifest.extensions).categories)
  const trustState = release?.trust_level ?? catalogue?.trust ?? stringField(recordFromJson(manifest.trust).requestedLevel) ?? 'untrustedManifest'
  const document: GreenfieldSearchDocument = {
    documentId: `module:${moduleId}`,
    schemaVersion: '1.0.0',
    entityType: 'module',
    entityId: moduleId,
    sourceVersion: projector.sourceVersionFor(context, Date.now()),
    title: name,
    body: [description, stringField(recordFromJson(manifest.publisher).displayName), capabilities.join(' '), platforms.join(' ')].filter(Boolean).join(' '),
    summary: description,
    keywords: Array.from(new Set([moduleId, name, catalogue?.publisher, ...capabilities, ...platforms].filter(Boolean).map(item => item!.toLowerCase()))),
    tags: categories,
    visibility: 'public',
    status,
    language: 'en',
    createdAt: (catalogue?.created_at ?? release?.created_at ?? new Date()).toISOString(),
    updatedAt: (catalogue?.updated_at ?? release?.updated_at ?? new Date()).toISOString(),
    indexedAt: new Date().toISOString(),
    metadata: {
      publisher: catalogue?.publisher ?? recordFromJson(manifest.publisher).displayName,
      trustState,
      version: catalogue?.version ?? release?.version,
      categories,
      capabilities,
      platforms,
      status: catalogue?.catalogue_status ?? release?.release_state,
      installable: status === 'active' && catalogue?.catalogue_status === 'active',
    },
  }
  await projector.upsert({...context, entityId: moduleId}, document)
}

function moduleIdFromEvent(context: SearchProjectionContext): string {
  const fromPayload = context.event.payload?.moduleId
  if (typeof fromPayload === 'string' && fromPayload) return fromPayload
  return entityIdFromEvent(context.event, context.event.aggregateId)
}

async function latestRelease(db: ModulaWorkerDb, moduleId: string) {
  return db
    .selectFrom('greenfield_module_releases')
    .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
    .selectAll('greenfield_module_releases')
    .select('greenfield_module_versions.manifest')
    .where('greenfield_module_releases.module_id', '=', moduleId)
    .orderBy('greenfield_module_releases.updated_at', 'desc')
    .executeTakeFirst()
}

function statusForModule(catalogueStatus: string | undefined, releaseState: string | undefined): GreenfieldSearchDocument['status'] {
  if (releaseState === 'quarantined' || releaseState === 'revoked') return 'quarantined'
  if (catalogueStatus === 'active') return 'active'
  if (catalogueStatus === 'inactive' || catalogueStatus === 'unavailable') return 'unavailable'
  return releaseState === 'published' ? 'active' : 'unavailable'
}

function contributionKeys(value: unknown): string[] {
  const contributions = recordFromJson(value)
  const keys: string[] = []
  for (const group of Object.values(contributions)) {
    if (!Array.isArray(group)) continue
    for (const item of group) {
      if (item && typeof item === 'object' && typeof (item as any).id === 'string') keys.push((item as any).id)
    }
  }
  return keys
}

function recordFromJson(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
}

function stringField(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function arrayOfStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}
