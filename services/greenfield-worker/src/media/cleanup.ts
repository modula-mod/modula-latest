import {lstat, realpath, rm} from 'node:fs/promises'
import {join, relative, sep} from 'node:path'
import type {ModulaWorkerDb} from '../database.js'

const CLEANABLE_STATUSES = ['ready', 'failed', 'expired', 'rejected'] as const
const SAFE_STORAGE_KEY = /^[0-9a-f-]{36}\.[a-z0-9]+$/i
export const DEFAULT_ATTACHMENT_ORPHAN_RETENTION_MS = 7 * 24 * 60 * 60 * 1_000

export type AttachmentCleanupMode = 'dry-run' | 'delete'

export type AttachmentCleanupOptions = {
  mode: AttachmentCleanupMode
  mediaRoot: string
  now?: Date
  retentionMs: number
  activeUploadGraceMs: number
  batchSize: number
}

export type AttachmentCleanupResult = {
  mode: AttachmentCleanupMode
  expiredSessionCandidates: number
  expiredSessions: number
  skippedActiveUploads: number
  orphanCandidates: number
  removedAttachments: number
  unsafeStorageKeys: number
  unsupportedProviders: number
}

/**
 * Bounded attachment lifecycle pass. Delete mode fails closed unless the
 * configured filesystem root is present and is not redirected through a
 * symlink. Per-row locks arbitrate with API publication transactions.
 */
export async function runAttachmentCleanup(
  db: ModulaWorkerDb,
  options: AttachmentCleanupOptions,
): Promise<AttachmentCleanupResult> {
  const now = options.now ?? new Date()
  const cutoff = new Date(now.getTime() - options.retentionMs)
  const activeUploadCutoff = new Date(now.getTime() - options.activeUploadGraceMs)
  const result: AttachmentCleanupResult = {
    mode: options.mode,
    expiredSessionCandidates: 0,
    expiredSessions: 0,
    skippedActiveUploads: 0,
    orphanCandidates: 0,
    removedAttachments: 0,
    unsafeStorageKeys: 0,
    unsupportedProviders: 0,
  }

  const expired = await db.selectFrom('attachment_upload_sessions')
    .select(['upload_id', 'state', 'updated_at'])
    .where('expires_at', '<', now)
    .where('state', 'in', ['created', 'uploading'])
    .orderBy('expires_at', 'asc')
    .limit(options.batchSize)
    .execute()
  result.expiredSessionCandidates = expired.length
  result.skippedActiveUploads = expired.filter(row => row.state === 'uploading' && row.updated_at > activeUploadCutoff).length

  const candidates = await db.selectFrom('attachments')
    .select(['attachment_id', 'storage_key', 'storage_provider'])
    .where('attached_at', 'is', null)
    .where('created_at', '<', cutoff)
    .where('status', 'in', [...CLEANABLE_STATUSES])
    .orderBy('created_at', 'asc')
    .limit(options.batchSize)
    .execute()
  result.orphanCandidates = candidates.length
  result.unsafeStorageKeys = candidates.filter(row => row.storage_key !== null && !SAFE_STORAGE_KEY.test(row.storage_key)).length
  result.unsupportedProviders = candidates.filter(row => row.storage_provider !== 'filesystem').length

  if (options.mode === 'dry-run') return result

  const attachmentsRoot = await validatedAttachmentsRoot(options.mediaRoot)
  for (const session of expired) {
    if (session.state === 'uploading' && session.updated_at > activeUploadCutoff) continue
    if (await expireUploadSession(db, session.upload_id, now, activeUploadCutoff)) result.expiredSessions += 1
  }

  for (const candidate of candidates) {
    if (candidate.storage_provider !== 'filesystem') continue
    if (candidate.storage_key !== null && !SAFE_STORAGE_KEY.test(candidate.storage_key)) continue
    if (await removeAttachment(db, candidate.attachment_id, attachmentsRoot, cutoff)) {
      result.removedAttachments += 1
    }
  }
  return result
}

async function validatedAttachmentsRoot(mediaRoot: string): Promise<string> {
  const rootInfo = await lstat(mediaRoot)
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('Media root must be a real directory')
  const attachmentsRoot = join(mediaRoot, 'attachments')
  const attachmentInfo = await lstat(attachmentsRoot)
  if (!attachmentInfo.isDirectory() || attachmentInfo.isSymbolicLink()) {
    throw new Error('Attachment storage root must be a real directory')
  }
  const [realRoot, realAttachments] = await Promise.all([realpath(mediaRoot), realpath(attachmentsRoot)])
  const pathFromRoot = relative(realRoot, realAttachments)
  if (!pathFromRoot || pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === '..') {
    throw new Error('Attachment storage root is outside the configured media root')
  }
  return realAttachments
}

async function expireUploadSession(
  db: ModulaWorkerDb,
  uploadId: string,
  now: Date,
  activeUploadCutoff: Date,
): Promise<boolean> {
  return db.transaction().execute(async trx => {
    const session = await trx.selectFrom('attachment_upload_sessions')
      .select(['attachment_id', 'state', 'expires_at', 'updated_at'])
      .where('upload_id', '=', uploadId)
      .forUpdate()
      .executeTakeFirst()
    if (!session || session.expires_at >= now || !['created', 'uploading'].includes(session.state)) return false
    if (session.state === 'uploading' && session.updated_at > activeUploadCutoff) return false
    const attachment = await trx.selectFrom('attachments').select('status')
      .where('attachment_id', '=', session.attachment_id).forUpdate().executeTakeFirst()
    if (!attachment || !['created', 'uploading', 'failed'].includes(attachment.status)) return false
    await trx.updateTable('attachment_upload_sessions').set({state: 'expired', updated_at: now})
      .where('upload_id', '=', uploadId).execute()
    await trx.updateTable('attachments').set({status: 'expired', updated_at: now})
      .where('attachment_id', '=', session.attachment_id).execute()
    return true
  })
}

async function removeAttachment(
  db: ModulaWorkerDb,
  attachmentId: string,
  attachmentsRoot: string,
  cutoff: Date,
): Promise<boolean> {
  return db.transaction().execute(async trx => {
    const row = await trx.selectFrom('attachments')
      .select(['storage_key', 'storage_provider', 'status', 'attached_at', 'created_at'])
      .where('attachment_id', '=', attachmentId)
      .forUpdate()
      .executeTakeFirst()
    if (!row || row.attached_at || row.created_at >= cutoff || !CLEANABLE_STATUSES.includes(row.status as typeof CLEANABLE_STATUSES[number])) {
      return false
    }
    if (row.storage_provider !== 'filesystem') return false
    if (row.storage_key !== null) {
      if (!SAFE_STORAGE_KEY.test(row.storage_key)) return false
      // Remove bytes before the row. A filesystem error rolls back the
      // transaction, retaining the storage key for a later retry.
      await rm(join(attachmentsRoot, row.storage_key), {force: true})
    }
    await trx.deleteFrom('attachments').where('attachment_id', '=', attachmentId).execute()
    return true
  })
}
