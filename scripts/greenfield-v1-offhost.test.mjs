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
