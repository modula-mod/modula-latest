import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'

export class RepositoryService {
  constructor(private readonly db: ModulaDb) {}

  async getDefault(accountId: string) {
    return this.db
      .selectFrom('greenfield_repositories')
      .selectAll()
      .where('account_id', '=', accountId)
      .where('name', '=', 'default')
      .executeTakeFirst()
  }

  async getMe(accountId: string) {
    const repo = await this.getDefault(accountId)
    if (!repo) throw Object.assign(new Error('Repository not found'), {code: 'NOT_FOUND'})
    return {
      repositoryId: repo.repository_id,
      accountId: repo.account_id,
      status: 'active',
      currentRevision: Number(repo.revision),
      currentEventHash: repo.head_hash,
      createdAt: repo.created_at.toISOString(),
      updatedAt: repo.updated_at.toISOString(),
    }
  }

  list(accountId: string) {
    return this.db
      .selectFrom('greenfield_repositories')
      .selectAll()
      .where('account_id', '=', accountId)
      .orderBy('created_at', 'desc')
      .execute()
  }

  async createExport(accountId: string) {
    const repo = await this.getDefault(accountId)
    if (!repo) throw Object.assign(new Error('Repository not found'), {code: 'NOT_FOUND'})
    const exportId = uuidv7()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 60 * 60_000)
    await this.db
      .insertInto('greenfield_repository_exports')
      .values({
        export_id: exportId,
        repository_id: repo.repository_id,
        status: 'pending',
        location: null,
        created_at: now,
        expires_at: expiresAt,
      })
      .execute()

    const collections = await this.db
      .selectFrom('greenfield_records')
      .select(['collection', 'schema_version'])
      .where('repository_id', '=', repo.repository_id)
      .where('deleted_at', 'is', null)
      .execute()

    const byCollection = new Map<string, {collection: string; schemaVersions: Set<number>; recordCount: number}>()
    for (const row of collections) {
      const entry = byCollection.get(row.collection) ?? {
        collection: row.collection,
        schemaVersions: new Set<number>(),
        recordCount: 0,
      }
      entry.schemaVersions.add(row.schema_version)
      entry.recordCount += 1
      byCollection.set(row.collection, entry)
    }

    const manifest = {
      exportVersion: 1 as const,
      protocolVersion: '0.1' as const,
      accountId,
      repositoryId: repo.repository_id,
      firstRevision: 0,
      lastRevision: Number(repo.revision),
      rootHash: repo.head_hash ?? '',
      collections: Array.from(byCollection.values()).map(c => ({
        collection: c.collection,
        schemaVersions: Array.from(c.schemaVersions),
        recordCount: c.recordCount,
      })),
      createdAt: now.toISOString(),
    }

    await this.db
      .updateTable('greenfield_repository_exports')
      .set({status: 'ready', location: JSON.stringify(manifest)})
      .where('export_id', '=', exportId)
      .execute()

    return {exportId, expiresAt: expiresAt.toISOString(), manifest}
  }

  async getExport(accountId: string, exportId: string) {
    const row = await this.db
      .selectFrom('greenfield_repository_exports')
      .innerJoin(
        'greenfield_repositories',
        'greenfield_repositories.repository_id',
        'greenfield_repository_exports.repository_id',
      )
      .selectAll('greenfield_repository_exports')
      .where('greenfield_repository_exports.export_id', '=', exportId)
      .where('greenfield_repositories.account_id', '=', accountId)
      .executeTakeFirst()
    if (!row) throw Object.assign(new Error('Export not found'), {code: 'NOT_FOUND'})
    if (row.expires_at && row.expires_at <= new Date()) {
      throw Object.assign(new Error('Export expired'), {code: 'FORBIDDEN'})
    }
    return {
      exportId: row.export_id,
      status: row.status,
      expiresAt: row.expires_at?.toISOString() ?? null,
      manifest: row.location ? JSON.parse(row.location) : null,
    }
  }
}
