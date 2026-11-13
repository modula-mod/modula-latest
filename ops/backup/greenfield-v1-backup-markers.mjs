/**
 * GF-OPS-02: completion markers for ops/backup/greenfield-v1-backup.mjs.
 *
 * Ordering contract (Forge review of #175):
 *   1. the local set is already written and verified by the caller;
 *   2. when MODULA_OFFHOST_BACKUP_ENABLED=1 the off-host copy runs FIRST and its outcome is
 *      recorded in last-offhost-success.json or last-offhost-failure.json;
 *   3. last-success.json is written LAST, and only when the run as a whole succeeded:
 *      - off-host disabled               -> written, offhost.status = "disabled"
 *      - off-host copied                 -> written, offhost.status = "copied"
 *      - off-host failed, not required   -> written, offhost.status = "failed" (local set is
 *                                           valid; the failure marker must be alerted on)
 *      - off-host failed, REQUIRED=1     -> NOT written; the run fails, so last-success.json
 *                                           keeps pointing at the previous fully successful run.
 * Markers are written atomically (temp file + rename), owner-only.
 */
import {renameSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {spawnSync} from 'node:child_process'

export function writeMarker(outputRoot, name, value) {
  const path = join(outputRoot, name)
  const temporary = `${path}.${process.pid}.tmp`
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {mode: 0o600, flag: 'w'})
  renameSync(temporary, path)
  return path
}

/** Default off-host push: the CLI, so the copy runs with the operator's environment. */
export function offHostPushViaCli(tool, backupDir, env) {
  const result = spawnSync(process.execPath, [tool, 'push', '--backup-dir', backupDir], {env, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024})
  if (result.status === 0) return {ok: true, report: JSON.parse(result.stdout.trim().split('\n').at(-1))}
  return {ok: false, error: result.stderr || result.stdout || 'off-host copy failed'}
}

export function commitBackupRun({outputRoot, marker, backupDir, env = process.env, pushOffHost, redact = value => String(value), now = () => new Date()}) {
  let offhost = {status: 'disabled'}
  if (env.MODULA_OFFHOST_BACKUP_ENABLED === '1') {
    const result = pushOffHost(backupDir)
    const at = now().toISOString()
    if (result.ok) {
      const report = result.report
      writeMarker(outputRoot, 'last-offhost-success.json', {format: 'modula.greenfield.offhost-success.v1', completedAt: at, sourceRevision: marker.sourceRevision, backupSetId: report.backupSetId, target: report.target, fileCount: report.fileCount})
      offhost = {status: 'copied', completedAt: at, target: report.target, fileCount: report.fileCount}
    } else {
      const error = redact(result.error)
      writeMarker(outputRoot, 'last-offhost-failure.json', {format: 'modula.greenfield.offhost-failure.v1', failedAt: at, backupSetId: marker.backupSetId, error})
      if (env.MODULA_OFFHOST_BACKUP_REQUIRED === '1') throw new Error(`off-host copy failed (MODULA_OFFHOST_BACKUP_REQUIRED=1; last-success.json not updated): ${error}`)
      offhost = {status: 'failed', failedAt: at, error}
    }
  }
  const committed = {...marker, offhost}
  writeMarker(outputRoot, 'last-success.json', committed)
  return committed
}
