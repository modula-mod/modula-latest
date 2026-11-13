#!/usr/bin/env node
/**
 * GF-OPS-02: opt-in off-host copy of GreenField recovery sets.
 *
 * Ships a set produced by greenfield-backend-v1-recovery.mjs (age-encrypted
 * payloads + HMAC-signed manifest) to a destination off the VPS, and fetches it
 * back for a restore drill. It never decrypts and never adds plaintext: every
 * payload must already carry the age header and match the signed manifest.
 *
 * Disabled unless MODULA_OFFHOST_BACKUP_ENABLED=1. Destination (no secrets in
 * the URI; SSH keys/known_hosts live in the operator's ssh config outside Git):
 *   MODULA_OFFHOST_BACKUP_TARGET=file:///mnt/offhost/greenfield-v1      (mounted disk / NFS)
 *   MODULA_OFFHOST_BACKUP_TARGET=ssh://backup@host.example/srv/modula   (rsync over ssh, BatchMode)
 *
 * Commands:
 *   push   --backup-dir <set> [--dry-run]   copy set, receipt written last (commit marker)
 *   pull   --set <id> --to <dir>            fetch into an empty isolated dir and verify
 *   list                                    committed set ids at the destination
 *   check  --backup-dir <set>               local pre-flight only (what push validates)
 */
import {Buffer} from 'node:buffer'
import {createHash, createHmac, timingSafeEqual} from 'node:crypto'
import {closeSync, copyFileSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, writeFileSync} from 'node:fs'
import {basename, dirname, join, relative, resolve, sep} from 'node:path'
import {spawnSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'

export const AGE_MAGIC = 'age-encryption.org/v1\n'
export const RECEIPT_FORMAT = 'modula.greenfield.offhost-receipt.v1'
const SET_ID = /^gbv1-recovery-\d{8}T\d{9}Z$/
const META_FILES = new Set(['manifest.json', 'manifest.hmac', 'checksums.sha256'])

export function parseTarget(value) {
  if (!value) fail('MODULA_OFFHOST_BACKUP_TARGET is required when off-host backup is enabled')
  const url = new URL(value)
  if (url.password || url.search || url.hash) fail('off-host target must not embed credentials, query or fragment')
  const path = decodeURIComponent(url.pathname).replace(/\/+$/, '')
  if (!path.startsWith('/') || ['/', '/root', '/var', '/tmp', '/home', '/srv', '/mnt'].includes(path)) fail('off-host target path must be a dedicated absolute directory')
  if (url.protocol === 'file:') {
    if (url.host) fail('file:// target must be local (file:///path)')
    return {kind: 'file', path, display: `file://${path}`}
  }
  if (url.protocol === 'ssh:') {
    if (!url.hostname || !/^[A-Za-z0-9._-]+$/.test(url.hostname)) fail('ssh target host is invalid')
    if (url.username && !/^[a-z_][a-z0-9_-]{0,31}$/.test(url.username)) fail('ssh target user is invalid')
    if (!/^[A-Za-z0-9._/-]+$/.test(path)) fail('ssh target path contains unsupported characters')
    const host = `${url.username ? `${url.username}@` : ''}${url.hostname}`
    return {kind: 'ssh', host, port: url.port || '', path, display: `ssh://${host}${url.port ? `:${url.port}` : ''}${path}`}
  }
  fail(`unsupported off-host target scheme: ${url.protocol}`)
}

/**
 * Validate a local set: HMAC-verified manifest, digests, age headers, no stray files.
 * Fails closed: without MODULA_RECOVERY_SIGNING_KEY nothing is pushed or accepted, because an
 * unverified manifest would let a substituted set (or stray files it declares) through. There is
 * deliberately no opt-out; tests pass an ephemeral key.
 */
function requireSigningKey(signingKey) {
  if (typeof signingKey !== 'string' || !signingKey) fail('MODULA_RECOVERY_SIGNING_KEY is required: refusing a recovery set whose manifest signature cannot be verified')
  return signingKey
}

export function inspectSet(backupDir, {signingKey = process.env.MODULA_RECOVERY_SIGNING_KEY} = {}) {
  requireSigningKey(signingKey)
  const dir = resolve(backupDir)
  const setId = basename(dir)
  if (!SET_ID.test(setId)) fail(`not a recovery set directory: ${setId}`)
  for (const name of META_FILES) if (!isFile(join(dir, name))) fail(`recovery set is missing ${name}`)
  const encoded = readFileSync(join(dir, 'manifest.json'))
  const manifest = JSON.parse(encoded.toString('utf8'))
  if (manifest.format !== 'modula.greenfield.recovery.v1' || manifest.backupSetId !== setId || !Array.isArray(manifest.payloads)) fail('unsupported or mismatched recovery manifest')
  if (manifest.encryption?.algorithm !== 'age') fail('recovery set is not age-encrypted')
  const expected = createHmac('sha256', signingKey).update(encoded).digest()
  const provided = Buffer.from(readFileSync(join(dir, 'manifest.hmac'), 'utf8').trim(), 'hex')
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) fail('recovery manifest signature invalid')
  const signature = 'valid'
  const declared = new Map(manifest.payloads.map(payload => [payload.file, payload]))
  const files = listFiles(dir)
  for (const file of files) {
    if (META_FILES.has(file)) continue
    const payload = declared.get(file)
    if (!payload) fail(`file not declared by the signed manifest: ${file}`)
    if (!file.startsWith('payloads/') || !file.endsWith('.age')) fail(`payload is not an .age file: ${file}`)
    if (readHead(join(dir, file), AGE_MAGIC.length) !== AGE_MAGIC) fail(`payload is not age ciphertext: ${file}`)
    if (sha256File(join(dir, file)) !== payload.sha256) fail(`payload checksum mismatch: ${file}`)
  }
  for (const file of declared.keys()) if (!files.includes(file)) fail(`declared payload missing: ${file}`)
  const entries = files.map(file => ({file, sha256: sha256File(join(dir, file)), byteLength: statSync(join(dir, file)).size}))
  return {setId, manifest, signature, entries}
}

export function push(backupDir, target, {dryRun = false, now = new Date(), signingKey} = {}) {
  const set = inspectSet(backupDir, {signingKey})
  const receipt = {
    format: RECEIPT_FORMAT, backupSetId: set.setId, sourceRevision: set.manifest.sourceRevision,
    manifestCreatedAt: set.manifest.createdAt, pushedAt: now.toISOString(), target: target.display,
    manifestSignature: set.signature, files: set.entries,
  }
  const plan = {ok: true, operation: 'push', dryRun, backupSetId: set.setId, target: target.display, fileCount: set.entries.length, bytes: set.entries.reduce((sum, entry) => sum + entry.byteLength, 0)}
  if (dryRun) return {...plan, commands: target.kind === 'ssh' ? sshPushCommands(resolve(backupDir), target, set.setId) : undefined}
  if (target.kind === 'file') pushFile(resolve(backupDir), target, set, receipt)
  else pushSsh(resolve(backupDir), target, set, receipt)
  return plan
}

export function pull(setId, destination, target, {signingKey = process.env.MODULA_RECOVERY_SIGNING_KEY} = {}) {
  requireSigningKey(signingKey) // before anything is fetched: an unverifiable copy is never staged
  if (!SET_ID.test(setId)) fail('invalid set id')
  const into = resolve(destination)
  if (existsSync(into) && readdirSync(into).length) fail('pull destination must be empty')
  mkdirSync(into, {recursive: true, mode: 0o700})
  const local = join(into, setId)
  if (target.kind === 'file') {
    const remote = join(target.path, setId)
    if (!isFile(join(target.path, `${setId}.receipt.json`))) fail(`no committed off-host copy for ${setId}`)
    copyTree(remote, local)
    copyFileSync(join(target.path, `${setId}.receipt.json`), join(into, `${setId}.receipt.json`))
  } else {
    run('rsync', [...rsyncBase(target), `${target.host}:${target.path}/${setId}.receipt.json`, `${into}/`])
    run('rsync', [...rsyncBase(target), `${target.host}:${target.path}/${setId}/`, `${local}/`])
  }
  const receipt = JSON.parse(readFileSync(join(into, `${setId}.receipt.json`), 'utf8'))
  if (receipt.format !== RECEIPT_FORMAT || receipt.backupSetId !== setId) fail('off-host receipt invalid')
  const set = inspectSet(local, {signingKey})
  const want = new Map(receipt.files.map(entry => [entry.file, entry.sha256]))
  if (want.size !== set.entries.length) fail('off-host copy file count differs from receipt')
  for (const entry of set.entries) if (want.get(entry.file) !== entry.sha256) fail(`off-host copy differs from receipt: ${entry.file}`)
  return {ok: true, operation: 'pull', backupSetId: setId, backupDir: local, fileCount: set.entries.length, manifestSignature: set.signature}
}

export function list(target) {
  if (target.kind === 'file') {
    if (!existsSync(target.path)) return []
    return readdirSync(target.path).filter(name => name.endsWith('.receipt.json')).map(name => name.slice(0, -'.receipt.json'.length)).filter(id => SET_ID.test(id)).sort()
  }
  const out = run('ssh', [...sshOptions(target), target.host, 'ls', '-1', '--', target.path])
  return out.split('\n').filter(name => name.endsWith('.receipt.json')).map(name => name.slice(0, -'.receipt.json'.length)).filter(id => SET_ID.test(id)).sort()
}

function pushFile(source, target, set, receipt) {
  mkdirSync(target.path, {recursive: true, mode: 0o700})
  const final = join(target.path, set.setId)
  const partial = join(target.path, `.${set.setId}.partial`)
  const receiptPath = join(target.path, `${set.setId}.receipt.json`)
  if (existsSync(receiptPath)) fail(`off-host copy already committed: ${set.setId}`)
  rmSync(partial, {recursive: true, force: true})
  rmSync(final, {recursive: true, force: true})
  copyTree(source, partial)
  for (const entry of set.entries) if (sha256File(join(partial, entry.file)) !== entry.sha256) fail(`off-host write verification failed: ${entry.file}`)
  renameSync(partial, final)
  writeFileSync(`${receiptPath}.partial`, `${JSON.stringify(receipt, null, 2)}\n`, {mode: 0o600})
  renameSync(`${receiptPath}.partial`, receiptPath)
}

export function sshPushCommands(source, target, setId) {
  return [
    ['ssh', [...sshOptions(target), target.host, 'mkdir', '-p', '-m', '700', '--', target.path]],
    ['rsync', [...rsyncBase(target), '--chmod=D700,F600', `${source}/`, `${target.host}:${target.path}/${setId}/`]],
    ['rsync', [...rsyncBase(target), '--checksum', '--dry-run', '--itemize-changes', `${source}/`, `${target.host}:${target.path}/${setId}/`]],
    ['rsync', [...rsyncBase(target), '--chmod=F600', '<receipt>', `${target.host}:${target.path}/${setId}.receipt.json`]],
  ]
}

function pushSsh(source, target, set, receipt) {
  const commands = sshPushCommands(source, target, set.setId)
  run(...commands[0])
  run(...commands[1])
  const drift = run(...commands[2]).trim()
  if (drift) fail('off-host copy differs after transfer')
  const staging = join(dirname(source), `.${set.setId}.receipt.json`)
  writeFileSync(staging, `${JSON.stringify(receipt, null, 2)}\n`, {mode: 0o600})
  try {
    run(commands[3][0], commands[3][1].map(value => value === '<receipt>' ? staging : value))
  } finally {
    rmSync(staging, {force: true})
  }
}

function sshOptions(target) {
  return ['-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes', ...(target.port ? ['-p', target.port] : [])]
}
function rsyncBase(target) {
  return ['--archive', '--protect-args', '-e', ['ssh', ...sshOptions(target)].join(' ')]
}

function copyTree(source, destination) {
  mkdirSync(destination, {recursive: true, mode: 0o700})
  for (const name of readdirSync(source)) {
    const from = join(source, name)
    const to = join(destination, name)
    const info = lstatSync(from)
    if (info.isSymbolicLink()) fail(`refusing symlink in recovery set: ${name}`)
    if (info.isDirectory()) copyTree(from, to)
    else copyFileSync(from, to)
  }
}

function listFiles(root) {
  const out = []
  ;(function walk(dir) {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name)
      const info = lstatSync(path)
      if (info.isSymbolicLink()) fail(`refusing symlink in recovery set: ${relative(root, path)}`)
      if (info.isDirectory()) walk(path)
      else out.push(relative(root, path).split(sep).join('/'))
    }
  })(root)
  return out
}

function readHead(path, length) {
  const fd = openSync(path, 'r')
  try {
    const buffer = Buffer.alloc(length)
    const count = readSync(fd, buffer, 0, length, 0)
    return buffer.subarray(0, count).toString('utf8')
  } finally {
    closeSync(fd)
  }
}
function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
function isFile(path) {
  return existsSync(path) && statSync(path).isFile()
}
function run(command, args) {
  const result = spawnSync(command, args, {encoding: 'utf8', maxBuffer: 16 * 1024 * 1024})
  if (result.status !== 0) fail(`${command} failed: ${String(result.stderr || result.error?.message || '').slice(0, 600).trim()}`)
  return result.stdout
}
function fail(message) {
  throw new Error(message)
}

function argsOf(values) {
  const out = {}
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index]
    if (key === '--dry-run') { out['dry-run'] = true; continue }
    if (!key.startsWith('--') || values[index + 1] === undefined) usage()
    out[key.slice(2)] = values[index + 1]
    index += 1
  }
  return out
}
function usage() {
  console.error('usage: greenfield-v1-offhost.mjs <push --backup-dir <set> [--dry-run] | pull --set <id> --to <dir> | list | check --backup-dir <set>>')
  process.exit(2)
}

function main() {
  const [command, ...rest] = process.argv.slice(2)
  const args = argsOf(rest)
  if (command === 'check') {
    const set = inspectSet(args['backup-dir'] ?? usage())
    console.log(JSON.stringify({ok: true, operation: 'check', backupSetId: set.setId, fileCount: set.entries.length, manifestSignature: set.signature}))
    return
  }
  if (process.env.MODULA_OFFHOST_BACKUP_ENABLED !== '1') {
    console.log(JSON.stringify({ok: true, operation: command ?? 'none', skipped: 'MODULA_OFFHOST_BACKUP_ENABLED is not 1'}))
    return
  }
  const target = parseTarget(process.env.MODULA_OFFHOST_BACKUP_TARGET)
  if (command === 'push') console.log(JSON.stringify(push(args['backup-dir'] ?? usage(), target, {dryRun: Boolean(args['dry-run'])})))
  else if (command === 'pull') console.log(JSON.stringify(pull(args.set ?? usage(), args.to ?? usage(), target)))
  else if (command === 'list') console.log(JSON.stringify({ok: true, operation: 'list', target: target.display, sets: list(target)}))
  else usage()
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main()
  } catch (error) {
    console.error(JSON.stringify({ok: false, error: error instanceof Error ? error.message : String(error)}))
    process.exit(1)
  }
}
