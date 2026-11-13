#!/usr/bin/env node
// GF-OPS-02 tests for ops/backup/greenfield-v1-offhost.mjs against a local fake remote (no age, no DB, no network).
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {createHash, createHmac, randomBytes} from 'node:crypto'
import {existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import {AGE_MAGIC, inspectSet, list, parseTarget, pull, push, sshPushCommands} from '../ops/backup/greenfield-v1-offhost.mjs'

const tool = 'ops/backup/greenfield-v1-offhost.mjs'
const key = randomBytes(32).toString('base64url')
const SET = 'gbv1-recovery-20261113T120000000Z'

function fixture({payloadBody = AGE_MAGIC + 'ciphertext-bytes', extra} = {}) {
  const root = mkdtempSync(join(tmpdir(), 'gf-ops-02-'))
  const dir = join(root, 'local', SET)
  mkdirSync(join(dir, 'payloads'), {recursive: true})
  const files = {'payloads/database-greenfield-core.dump.age': payloadBody, 'payloads/assets-greenfield-media.tar.gz.age': AGE_MAGIC + 'asset-ciphertext'}
  const payloads = Object.entries(files).map(([file, body]) => {
    writeFileSync(join(dir, file), body)
    return {id: file.includes('database') ? 'greenfield-core' : 'greenfield-media', kind: file.includes('database') ? 'DATABASE' : 'ASSETS', file, sha256: createHash('sha256').update(body).digest('hex')}
  })
  const manifest = `${JSON.stringify({format: 'modula.greenfield.recovery.v1', backupSetId: SET, createdAt: '2026-11-13T12:00:00.000Z', sourceRevision: 'a'.repeat(40), encryption: {algorithm: 'age'}, payloads}, null, 2)}\n`
  writeFileSync(join(dir, 'manifest.json'), manifest)
  writeFileSync(join(dir, 'manifest.hmac'), `${createHmac('sha256', key).update(manifest).digest('hex')}\n`)
  writeFileSync(join(dir, 'checksums.sha256'), payloads.map(p => `${p.sha256}  ${p.file}`).join('\n') + '\n')
  if (extra) writeFileSync(join(dir, extra), 'plaintext')
  const remote = join(root, 'offhost', 'greenfield-v1')
  return {root, dir, remote, target: parseTarget(`file://${remote}`), cleanup: () => rmSync(root, {recursive: true, force: true})}
}

test('disabled by default: CLI does nothing without MODULA_OFFHOST_BACKUP_ENABLED=1', () => {
  const f = fixture()
  try {
    const env = {...process.env, MODULA_OFFHOST_BACKUP_TARGET: `file://${f.remote}`}
    delete env.MODULA_OFFHOST_BACKUP_ENABLED
    const result = spawnSync(process.execPath, [tool, 'push', '--backup-dir', f.dir], {env, encoding: 'utf8'})
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /"skipped":"MODULA_OFFHOST_BACKUP_ENABLED is not 1"/)
    assert.equal(existsSync(f.remote), false)
  } finally { f.cleanup() }
})

test('target parsing rejects embedded credentials, unsupported schemes and broad paths', () => {
  assert.throws(() => parseTarget('ssh://u:secret@host/srv/modula/gf'), /must not embed credentials/)
  assert.throws(() => parseTarget('https://host/srv/modula/gf'), /unsupported off-host target scheme/)
  assert.throws(() => parseTarget('file:///tmp'), /dedicated absolute directory/)
  assert.throws(() => parseTarget('file://remote/x/y'), /must be local/)
  assert.throws(() => parseTarget(''), /required/)
  assert.deepEqual(parseTarget('ssh://backup@offhost.example:2222/srv/modula/greenfield-v1'), {kind: 'ssh', host: 'backup@offhost.example', port: '2222', path: '/srv/modula/greenfield-v1', display: 'ssh://backup@offhost.example:2222/srv/modula/greenfield-v1'})
})

test('dry-run validates but writes nothing; push commits receipt last; pull verifies', () => {
  const f = fixture()
  try {
    const plan = push(f.dir, f.target, {dryRun: true, signingKey: key})
    assert.equal(plan.dryRun, true)
    assert.equal(plan.fileCount, 5)
    assert.equal(existsSync(f.remote), false)
    const pushed = push(f.dir, f.target, {signingKey: key})
    assert.equal(pushed.ok, true)
    assert.deepEqual(readdirSync(f.remote).sort(), [SET, `${SET}.receipt.json`])
    const receipt = JSON.parse(readFileSync(join(f.remote, `${SET}.receipt.json`), 'utf8'))
    assert.equal(receipt.manifestSignature, 'valid')
    assert.equal(receipt.files.length, 5)
    assert.deepEqual(list(f.target), [SET])
    assert.throws(() => push(f.dir, f.target, {signingKey: key}), /already committed/)
    rmSync(f.dir, {recursive: true})
    const restoreStage = join(f.root, 'restore-drill-stage')
    const pulled = pull(SET, restoreStage, f.target, {signingKey: key})
    assert.equal(pulled.ok, true)
    assert.equal(pulled.manifestSignature, 'valid')
    assert.throws(() => pull(SET, restoreStage, f.target, {signingKey: key}), /must be empty/)
  } finally { f.cleanup() }
})

test('tampered off-host ciphertext is rejected on pull', () => {
  const f = fixture()
  try {
    push(f.dir, f.target, {signingKey: key})
    writeFileSync(join(f.remote, SET, 'payloads/database-greenfield-core.dump.age'), AGE_MAGIC + 'tampered')
    assert.throws(() => pull(SET, join(f.root, 'restore-a'), f.target, {signingKey: key}), /payload checksum mismatch/)
  } finally { f.cleanup() }
})

test('uncommitted (no receipt) off-host copy is not pullable', () => {
  const f = fixture()
  try {
    push(f.dir, f.target, {signingKey: key})
    rmSync(join(f.remote, `${SET}.receipt.json`))
    assert.deepEqual(list(f.target), [])
    assert.throws(() => pull(SET, join(f.root, 'restore-b'), f.target, {signingKey: key}), /no committed off-host copy/)
  } finally { f.cleanup() }
})

test('refuses plaintext payloads, undeclared files and bad signatures', () => {
  const plain = fixture({payloadBody: 'PGDMP plaintext dump'})
  try { assert.throws(() => push(plain.dir, plain.target, {signingKey: key}), /not age ciphertext/) } finally { plain.cleanup() }
  const stray = fixture({extra: 'payloads/notes.txt'})
  try { assert.throws(() => push(stray.dir, stray.target, {signingKey: key}), /not declared by the signed manifest/) } finally { stray.cleanup() }
  const forged = fixture()
  try { assert.throws(() => push(forged.dir, forged.target, {signingKey: randomBytes(32).toString('base64url')}), /signature invalid/) } finally { forged.cleanup() }
})

test('fails closed without a signing key: no unverified manifest is inspected, pushed or pulled', () => {
  const f = fixture()
  const saved = process.env.MODULA_RECOVERY_SIGNING_KEY
  delete process.env.MODULA_RECOVERY_SIGNING_KEY
  try {
    const refused = /MODULA_RECOVERY_SIGNING_KEY is required: refusing a recovery set whose manifest signature cannot be verified/
    for (const signingKey of [undefined, '', null, 0]) assert.throws(() => inspectSet(f.dir, {signingKey}), refused, String(signingKey))
    assert.throws(() => inspectSet(f.dir), refused)
    assert.throws(() => push(f.dir, f.target), refused)
    assert.throws(() => push(f.dir, f.target, {dryRun: true}), refused)
    assert.equal(existsSync(f.remote), false)
    push(f.dir, f.target, {signingKey: key})
    assert.throws(() => pull(SET, join(f.root, 'restore-nokey'), f.target), refused)
    assert.equal(existsSync(join(f.root, 'restore-nokey')), false, 'nothing staged without a key')
    const env = {...process.env, MODULA_OFFHOST_BACKUP_ENABLED: '1', MODULA_OFFHOST_BACKUP_TARGET: `file://${f.remote}`}
    delete env.MODULA_RECOVERY_SIGNING_KEY
    for (const args of [['check', '--backup-dir', f.dir], ['pull', '--set', SET, '--to', join(f.root, 'restore-cli')]]) {
      const result = spawnSync(process.execPath, [tool, ...args], {env, encoding: 'utf8'})
      assert.equal(result.status, 1, args[0])
      assert.match(result.stderr, refused, args[0])
    }
    assert.equal(existsSync(join(f.root, 'restore-cli')), false, 'CLI pull staged nothing without a key')
    assert.equal(inspectSet(f.dir, {signingKey: key}).signature, 'valid')
  } finally {
    if (saved === undefined) delete process.env.MODULA_RECOVERY_SIGNING_KEY
    else process.env.MODULA_RECOVERY_SIGNING_KEY = saved
    f.cleanup()
  }
})

test('ssh transport is non-interactive, host-key pinned and credential-free', () => {
  const commands = sshPushCommands('/var/backups/modula/greenfield-v1/' + SET, parseTarget('ssh://backup@offhost.example/srv/modula/greenfield-v1'), SET)
  const flat = commands.map(([cmd, argv]) => [cmd, ...argv].join(' ')).join('\n')
  assert.match(flat, /BatchMode=yes/)
  assert.match(flat, /StrictHostKeyChecking=yes/)
  assert.match(flat, /--checksum --dry-run --itemize-changes/)
  assert.doesNotMatch(flat, /password|secret|AGE-SECRET-KEY/i)
  assert.equal(commands.at(-1)[1].at(-1), `backup@offhost.example:/srv/modula/greenfield-v1/${SET}.receipt.json`)
})

// Forge review of #175: last-success.json must be written after the off-host outcome is known.
test('backup markers: off-host outcome first, last-success.json last, REQUIRED keeps the previous success marker', async () => {
  const {commitBackupRun} = await import('../ops/backup/greenfield-v1-backup-markers.mjs')
  const root = mkdtempSync(join(tmpdir(), 'gf-ops-02-markers-'))
  const read = name => JSON.parse(readFileSync(join(root, name), 'utf8'))
  const previous = {format: 'modula.greenfield.backup-success.v1', completedAt: '2026-11-12T00:00:00.000Z', sourceRevision: 'p'.repeat(40), backupSetId: 'gbv1-recovery-20261112T000000000Z'}
  const marker = {format: 'modula.greenfield.backup-success.v1', completedAt: '2026-11-13T12:00:00.000Z', sourceRevision: 'a'.repeat(40), backupSetId: SET, backupDir: `/x/${SET}`, payloadCount: 2}
  const reset = () => { for (const name of readdirSync(root)) rmSync(join(root, name)); writeFileSync(join(root, 'last-success.json'), JSON.stringify(previous)) }
  const seenAtPush = []
  const ok = () => { seenAtPush.push(read('last-success.json').backupSetId); return {ok: true, report: {backupSetId: SET, target: 'file:///off/gf', fileCount: 4}} }
  const broken = () => { seenAtPush.push(read('last-success.json').backupSetId); return {ok: false, error: 'rsync failed postgres://user:pw@db/x'} }
  const redact = value => String(value).replaceAll(/postgres:\/\/\S+/g, '[redacted-database-url]')
  try {
    reset()
    let calls = 0
    const disabled = commitBackupRun({outputRoot: root, marker, backupDir: marker.backupDir, env: {}, pushOffHost: () => { calls += 1 }, redact})
    assert.equal(calls, 0)
    assert.deepEqual(disabled.offhost, {status: 'disabled'})
    assert.deepEqual(read('last-success.json'), {...marker, offhost: {status: 'disabled'}})
    assert.deepEqual(readdirSync(root).sort(), ['last-success.json'])

    reset()
    const copied = commitBackupRun({outputRoot: root, marker, backupDir: marker.backupDir, env: {MODULA_OFFHOST_BACKUP_ENABLED: '1'}, pushOffHost: ok, redact})
    assert.equal(seenAtPush.at(-1), previous.backupSetId, 'last-success.json must not be updated before the off-host copy finished')
    assert.equal(copied.offhost.status, 'copied')
    assert.equal(read('last-success.json').backupSetId, SET)
    assert.equal(read('last-offhost-success.json').backupSetId, SET)

    reset()
    const failed = commitBackupRun({outputRoot: root, marker, backupDir: marker.backupDir, env: {MODULA_OFFHOST_BACKUP_ENABLED: '1'}, pushOffHost: broken, redact})
    assert.equal(seenAtPush.at(-1), previous.backupSetId)
    assert.equal(failed.offhost.status, 'failed')
    assert.equal(read('last-success.json').offhost.status, 'failed', 'optional off-host: local success is recorded with the failure visible')
    assert.equal(read('last-offhost-failure.json').error, 'rsync failed [redacted-database-url]')

    reset()
    assert.throws(() => commitBackupRun({outputRoot: root, marker, backupDir: marker.backupDir, env: {MODULA_OFFHOST_BACKUP_ENABLED: '1', MODULA_OFFHOST_BACKUP_REQUIRED: '1'}, pushOffHost: broken, redact}), /MODULA_OFFHOST_BACKUP_REQUIRED=1; last-success.json not updated/)
    assert.deepEqual(read('last-success.json'), previous, 'required off-host failure must leave the previous success marker untouched')
    assert.equal(read('last-offhost-failure.json').backupSetId, SET)
    assert.deepEqual(readdirSync(root).filter(name => name.endsWith('.tmp')), [], 'no temp marker left behind')
  } finally { rmSync(root, {recursive: true, force: true}) }
  const wrapper = readFileSync('ops/backup/greenfield-v1-backup.mjs', 'utf8')
  assert.ok(!wrapper.includes("'last-success.json'"), 'the backup wrapper must not write last-success.json itself')
  assert.ok(wrapper.includes('commitBackupRun({'), 'the backup wrapper commits markers through commitBackupRun')
})

// Forge review of #175: restore-drill staging used an unanchored substring check.
test('restore drill staging: resolved-path containment refuses traversal, prefix and symlink tricks', async () => {
  const {resolveDrillStaging} = await import('../ops/backup/greenfield-v1-drill-paths.mjs')
  const {symlinkSync} = await import('node:fs')
  const base = mkdtempSync(join(tmpdir(), 'gf-ops-02-paths-'))
  const root = join(base, 'restore-drill')
  mkdirSync(root)
  mkdirSync(join(base, 'outside'))
  symlinkSync(join(base, 'outside'), join(root, 'escape'))
  const outContained = /must be strictly inside MODULA_RESTORE_DRILL_ROOT/
  try {
    assert.equal(resolveDrillStaging(join(root, 'stage'), {root}), join(root, 'stage'))
    assert.equal(resolveDrillStaging(join(root, 'a', 'b', 'stage'), {root}), join(root, 'a', 'b', 'stage'), 'not-yet-created nested dir is fine')
    assert.equal(resolveDrillStaging(join(root, 'x', '..', 'stage'), {root}), join(root, 'stage'), 'normalised inside root is fine')
    assert.equal(resolveDrillStaging(join(root, '..foo'), {root}), join(root, '..foo'), 'a name that merely starts with .. is still inside')
    for (const bad of [
      root, // the root itself
      `${root}/`,
      join(root, '..'), // parent
      join(root, '..', 'outside', 'stage'), // traversal
      join(root, 'a', '..', '..', 'outside'), // deeper traversal
      `${root}-evil/stage`, // sibling prefix trick
      `${root}evil`, // bare prefix trick
      join(base, 'latest', 'stage'), // old regex accepted any path containing "test"
      join(base, 'drill-but-not-root'), // old regex accepted any path containing "drill"
      '/var/backups/modula/greenfield-v1/restore', // old regex accepted "restore" anywhere
      join(root, 'escape', 'stage'), // symlink inside root pointing outside
    ]) assert.throws(() => resolveDrillStaging(bad, {root}), outContained, bad)
    assert.throws(() => resolveDrillStaging('', {root}), /staging path is required/)
    assert.throws(() => resolveDrillStaging(join(root, 's'), {root: 'relative/restore-drill'}), /must be an absolute path/)
    for (const broad of ['/', '/tmp', '/var/lib/modula', '/var/backups/modula', '/root']) assert.throws(() => resolveDrillStaging(`${broad}/x/stage`, {root: broad}), /dedicated directory/, broad)
    assert.throws(() => resolveDrillStaging(join(base, 'latest', 's'), {root: join(base, 'latest')}), /must identify a restore drill directory/)
    assert.throws(() => resolveDrillStaging(join(root, 'stage'), {root, avoid: [join(root, 'stage', 'offhost')]}), /overlaps a protected path/)
    assert.throws(() => resolveDrillStaging(join(root, 'stage', 'deeper'), {root, avoid: [join(root, 'stage')]}), /overlaps a protected path/)
    assert.equal(resolveDrillStaging(join(root, 'stage'), {root, avoid: [join(base, 'outside'), `${root}-stage`]}), join(root, 'stage'))
  } finally { rmSync(base, {recursive: true, force: true}) }
  const drill = readFileSync('ops/backup/greenfield-v1-restore-drill.mjs', 'utf8')
  assert.ok(drill.includes('resolveDrillStaging(required(\'staging\')'), 'restore drill uses resolved-path containment')
  assert.ok(!/test\(staging\)/.test(drill), 'no substring test on the staging path remains')
})
