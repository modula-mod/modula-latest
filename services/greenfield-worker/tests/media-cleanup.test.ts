import {randomUUID} from 'node:crypto'
import {access, mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterAll, beforeAll, describe, expect, it} from 'vitest'
import {createDb as createApiDb, type ModulaDb} from '../../greenfield-api/src/database/client.js'
import {migrateUp} from '../../greenfield-api/src/database/migrate.js'
import {createDb, type ModulaWorkerDb} from '../src/database.js'
import {DEFAULT_ATTACHMENT_ORPHAN_RETENTION_MS, runAttachmentCleanup} from '../src/media/cleanup.js'

const migrationDatabaseUrl = process.env.MODULA_TEST_DATABASE_URL
const workerDatabaseUrl = process.env.MODULA_TEST_WORKER_DATABASE_URL
const describeLive = migrationDatabaseUrl && workerDatabaseUrl ? describe : describe.skip

describeLive.sequential('attachment cleanup worker (real PostgreSQL and filesystem)', () => {
  let apiDb: ModulaDb
  let workerDb: ModulaWorkerDb
  let mediaRoot: string
  const suffix = randomUUID().replaceAll('-', '')
  const accountId = `media-cleanup-${suffix}`
  const now = new Date('2026-10-29T12:00:00.000Z')
  const old = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1_000)
  const retentionMs = DEFAULT_ATTACHMENT_ORPHAN_RETENTION_MS

  beforeAll(async () => {
    await migrateUp(migrationDatabaseUrl as string)
    apiDb = createApiDb(migrationDatabaseUrl as string)
    workerDb = createDb(workerDatabaseUrl as string)
    mediaRoot = await mkdtemp(join(tmpdir(), 'modula-media-cleanup-'))
    await mkdir(join(mediaRoot, 'attachments'))
    await apiDb.insertInto('greenfield_accounts').values({
      account_id: accountId,
      primary_handle: `cleanup${suffix}`.slice(0, 24),
      status: 'active',
      created_at: now,
      updated_at: now,
    }).execute()
  })

  afterAll(async () => {
    if (apiDb) {
      await apiDb.deleteFrom('greenfield_accounts').where('account_id', '=', accountId).execute()
      await apiDb.destroy()
    }
    if (workerDb) await workerDb.destroy()
    if (mediaRoot) await rm(mediaRoot, {recursive: true, force: true})
  })

  it('reports candidates without mutation, then safely removes only stale unbound media', async () => {
    const stale = await seedAttachment({status: 'ready', createdAt: old, withFile: true})
    const bound = await seedAttachment({status: 'ready', createdAt: old, attachedAt: old, withFile: true})
    const fresh = await seedAttachment({status: 'ready', createdAt: now, withFile: true})
    const unsafe = await seedAttachment({status: 'ready', createdAt: old, storageKey: '../unsafe.png'})
    const expiredCreated = await seedAttachment({status: 'created', createdAt: old})
    const activeUploading = await seedAttachment({status: 'uploading', createdAt: old})
    await seedSession(expiredCreated.id, 'created', old)
    await seedSession(activeUploading.id, 'uploading', now)

    const dryRun = await runAttachmentCleanup(workerDb, {
      mode: 'dry-run', mediaRoot, now, retentionMs, activeUploadGraceMs: 60 * 60 * 1_000, batchSize: 50,
    })
    expect(dryRun).toMatchObject({
      expiredSessionCandidates: 2,
      expiredSessions: 0,
      skippedActiveUploads: 1,
      orphanCandidates: 2,
      removedAttachments: 0,
      unsafeStorageKeys: 1,
    })
    expect(await attachmentStatus(stale.id)).toBe('ready')
    await expect(access(join(mediaRoot, 'attachments', stale.storageKey!))).resolves.toBeUndefined()

    const deleted = await runAttachmentCleanup(workerDb, {
      mode: 'delete', mediaRoot, now, retentionMs, activeUploadGraceMs: 60 * 60 * 1_000, batchSize: 50,
    })
    expect(deleted).toMatchObject({expiredSessions: 1, skippedActiveUploads: 1, removedAttachments: 1, unsafeStorageKeys: 1})
    expect(await attachmentStatus(stale.id)).toBeUndefined()
    await expect(access(join(mediaRoot, 'attachments', stale.storageKey!))).rejects.toThrow()
    expect(await attachmentStatus(bound.id)).toBe('ready')
    expect(await attachmentStatus(fresh.id)).toBe('ready')
    expect(await attachmentStatus(unsafe.id)).toBe('ready')
    expect(await attachmentStatus(expiredCreated.id)).toBe('expired')
    expect(await attachmentStatus(activeUploading.id)).toBe('uploading')
  })

  it('fails closed when the worker media volume is unavailable', async () => {
    const orphan = await seedAttachment({status: 'ready', createdAt: old, withFile: true})
    await expect(runAttachmentCleanup(workerDb, {
      mode: 'delete', mediaRoot: join(mediaRoot, 'missing'), now, retentionMs,
      activeUploadGraceMs: 60 * 60 * 1_000, batchSize: 50,
    })).rejects.toThrow()
    expect(await attachmentStatus(orphan.id)).toBe('ready')
    await expect(access(join(mediaRoot, 'attachments', orphan.storageKey!))).resolves.toBeUndefined()
  })

  async function seedAttachment(input: {
    status: 'created' | 'uploading' | 'ready'
    createdAt: Date
    attachedAt?: Date
    withFile?: boolean
    storageKey?: string
  }) {
    const id = randomUUID()
    const storageKey = input.storageKey ?? (input.withFile ? `${id}.png` : null)
    await apiDb.insertInto('attachments').values({
      attachment_id: id,
      owner_account_id: accountId,
      kind: 'image',
      mime_type: 'image/png',
      original_filename: `${id}.png`,
      byte_size: input.withFile ? '8' : '0',
      checksum: null,
      storage_key: storageKey,
      storage_provider: 'filesystem',
      status: input.status,
      width: null,
      height: null,
      duration_seconds: null,
      page_count: null,
      thumbnail_key: null,
      preview_key: null,
      metadata: {},
      attached_at: input.attachedAt ?? null,
      created_at: input.createdAt,
      updated_at: input.createdAt,
    }).execute()
    if (input.withFile && storageKey) await writeFile(join(mediaRoot, 'attachments', storageKey), 'fixture\n', {mode: 0o600})
    return {id, storageKey}
  }

  async function seedSession(attachmentId: string, state: 'created' | 'uploading', updatedAt: Date) {
    await apiDb.insertInto('attachment_upload_sessions').values({
      upload_id: randomUUID(), attachment_id: attachmentId, owner_account_id: accountId,
      expected_byte_size: '8', expected_mime_type: 'image/png', expected_checksum: null,
      state, expires_at: old, completed_at: null, created_at: old, updated_at: updatedAt,
    }).execute()
  }

  async function attachmentStatus(attachmentId: string) {
    return (await apiDb.selectFrom('attachments').select('status').where('attachment_id', '=', attachmentId).executeTakeFirst())?.status
  }
})
