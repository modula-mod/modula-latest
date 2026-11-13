#!/usr/bin/env node
// GF-SIGN-02 tests for scripts/verify-migration-ordering.mjs (node:test, no dependencies).
import assert from 'node:assert/strict'
import {spawnSync} from 'node:child_process'
import {cpSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import test from 'node:test'
import {DEFAULT_MIGRATIONS_DIR, DEFAULT_RUNNER, checkMigrations, parseLegacyIds, runnerOrder} from './verify-migration-ordering.mjs'

const script = 'scripts/verify-migration-ordering.mjs'
const runnerSource = readFileSync(DEFAULT_RUNNER, 'utf8')
const mainFiles = readdirSync(DEFAULT_MIGRATIONS_DIR)
const readMain = name => readFileSync(join(DEFAULT_MIGRATIONS_DIR, name), 'utf8')

function synthetic(entries) {
  const contents = new Map(Object.entries(entries))
  return {files: [...contents.keys()], read: name => contents.get(name) ?? ''}
}
const sv = value => `INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '${value}') ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;`

function withMainCopy(mutate) {
  const dir = mkdtempSync(join(tmpdir(), 'gf-sign-02-'))
  const migrations = join(dir, 'migrations')
  cpSync(DEFAULT_MIGRATIONS_DIR, migrations, {recursive: true})
  mutate(migrations)
  return {dir, migrations}
}
function cli(args) {
  return spawnSync(process.execPath, [script, ...args], {encoding: 'utf8'})
}

test('runner order mirrors migrate.ts listMigrationFiles (filename sort)', () => {
  assert.deepEqual(runnerOrder(['089_messaging_v3.sql', '089_greenfield_signer.sql', '089_greenfield_signer.down.sql']), ['089_greenfield_signer', '089_messaging_v3'])
  assert.deepEqual(parseLegacyIds(runnerSource), ['076_optional_package_media'])
})

test('current main passes', () => {
  const result = checkMigrations({files: mainFiles, read: readMain, runnerSource})
  assert.deepEqual(result.failures, [])
  assert.equal(result.ok, true)
  assert.equal(result.tip, runnerOrder(mainFiles).at(-1))
})

test('current main passes against itself as base', () => {
  const result = checkMigrations({files: mainFiles, read: readMain, runnerSource, baseFiles: mainFiles})
  assert.equal(result.ok, true, result.failures.join('\n'))
})

test('a correctly renumbered next migration passes against main as base', () => {
  const tip = Number(runnerOrder(mainFiles).at(-1).slice(0, 3))
  const next = String(tip + 1).padStart(3, '0')
  const files = [...mainFiles, `${next}_greenfield_signer.sql`, `${next}_greenfield_signer.down.sql`]
  const read = name => name.startsWith(`${next}_`) ? (name.includes('.down.') ? sv(String(tip).padStart(3, '0')) : sv(next)) : readMain(name)
  const result = checkMigrations({files, read, runnerSource, baseFiles: mainFiles})
  assert.equal(result.ok, true, result.failures.join('\n'))
})

test('synthetic 089 duplicate fails (089_greenfield_* would sort before 089_messaging_v3)', () => {
  const files = [...mainFiles, '089_greenfield_signer.sql', '089_greenfield_signer.down.sql']
  const read = name => name.startsWith('089_greenfield_signer') ? (name.includes('.down.') ? sv('088') : sv('089')) : readMain(name)
  const result = checkMigrations({files, read, runnerSource, baseFiles: mainFiles})
  assert.equal(result.ok, false)
  assert.ok(result.failures.some(f => f.startsWith('duplicate up-migration prefix 089: 089_greenfield_signer, 089_messaging_v3')), result.failures.join('\n'))
  assert.ok(result.failures.some(f => f.includes('new migration 089_greenfield_signer sorts before base tip')), result.failures.join('\n'))
})

test('CLI: main passes and synthetic 089 duplicate exits 1', () => {
  const pass = cli([])
  assert.equal(pass.status, 0, pass.stderr)
  const {dir, migrations} = withMainCopy(path => {
    writeFileSync(join(path, '089_greenfield_signer.sql'), sv('089'))
    writeFileSync(join(path, '089_greenfield_signer.down.sql'), sv('088'))
  })
  try {
    const failed = cli(['--dir', migrations, '--base-dir', DEFAULT_MIGRATIONS_DIR])
    assert.equal(failed.status, 1)
    assert.match(failed.stderr, /FAIL duplicate up-migration prefix 089/)
    assert.match(failed.stderr, /FAIL new migration 089_greenfield_signer sorts before base tip/)
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
})

test('CLI: renaming an applied migration fails against base', () => {
  const {dir, migrations} = withMainCopy(path => {
    renameSync(join(path, '090_calls_v1.sql'), join(path, '090_calls_v1_renamed.sql'))
    renameSync(join(path, '090_calls_v1.down.sql'), join(path, '090_calls_v1_renamed.down.sql'))
  })
  try {
    const failed = cli(['--dir', migrations, '--base-dir', DEFAULT_MIGRATIONS_DIR])
    assert.equal(failed.status, 1)
    assert.match(failed.stderr, /base migration removed or renamed: 090_calls_v1/)
  } finally {
    rmSync(dir, {recursive: true, force: true})
  }
})

test('out-of-order: a new migration numbered below the base tip fails', () => {
  const base = synthetic({'001_a.sql': sv('001'), '001_a.down.sql': '', '003_c.sql': sv('003'), '003_c.down.sql': sv('002')})
  const head = synthetic({'001_a.sql': sv('001'), '001_a.down.sql': '', '002_b.sql': sv('002'), '002_b.down.sql': sv('001'), '003_c.sql': sv('003'), '003_c.down.sql': sv('002')})
  const result = checkMigrations({files: head.files, read: head.read, runnerSource, baseFiles: base.files})
  assert.deepEqual(result.failures, ['new migration 002_b sorts before base tip 003_c; the runner sorts by filename (renumber after 003_c)'])
})

test('gap in numbering fails', () => {
  const head = synthetic({'001_a.sql': sv('001'), '001_a.down.sql': '', '003_c.sql': sv('003'), '003_c.down.sql': sv('002')})
  const result = checkMigrations({...head, runnerSource})
  assert.deepEqual(result.failures, ['gap in migration sequence: no up migration 002 before tip 003'])
})

test('missing .down pair and orphan .down fail', () => {
  const head = synthetic({'001_a.sql': sv('001'), '002_b.sql': sv('002'), '002_b.down.sql': sv('001'), '002_other.down.sql': ''})
  const result = checkMigrations({...head, runnerSource})
  assert.ok(result.failures.includes('up migration without .down pair: 001_a.sql (expected 001_a.down.sql)'), result.failures.join('\n'))
  assert.ok(result.failures.includes('.down migration without up migration: 002_other.down.sql'), result.failures.join('\n'))
  assert.ok(result.failures.some(f => f.startsWith('duplicate down-migration prefix 002')), result.failures.join('\n'))
})

test('bad filenames fail, including 4-digit prefixes that break filename sort', () => {
  const head = synthetic({'001_a.sql': sv('001'), '001_a.down.sql': '', '1000_big.sql': '', '002-Bad.sql': '', 'notes.txt': ''})
  const result = checkMigrations({...head, runnerSource})
  for (const name of ['1000_big.sql', '002-Bad.sql', 'notes.txt']) {
    assert.ok(result.failures.some(f => f.endsWith(`: ${name}`)), `${name}: ${result.failures.join('\n')}`)
  }
})

test('schema_version must match prefix on up, previous on down, and tip must write it', () => {
  const head = synthetic({'001_a.sql': sv('001'), '001_a.down.sql': '', '002_b.sql': sv('005'), '002_b.down.sql': sv('000'), '003_c.sql': 'SELECT 1;', '003_c.down.sql': sv('002')})
  const result = checkMigrations({...head, runnerSource})
  assert.ok(result.failures.includes("002_b.sql writes schema_version '005', expected '002'"), result.failures.join('\n'))
  assert.ok(result.failures.includes("002_b.down.sql writes schema_version '000', expected previous '001'"), result.failures.join('\n'))
  assert.ok(result.failures.includes("tip migration 003_c.sql does not write schema_metadata schema_version '003'"), result.failures.join('\n'))
})

test('file id colliding with a ledger-only legacy id fails', () => {
  const entries = {}
  for (let n = 1; n <= 76; n += 1) {
    const p = String(n).padStart(3, '0')
    const id = n === 76 ? '076_optional_package_media' : `${p}_m`
    entries[`${id}.sql`] = sv(p)
    entries[`${id}.down.sql`] = ''
  }
  const result = checkMigrations({...synthetic(entries), runnerSource})
  assert.ok(result.failures.some(f => f.startsWith('file id 076_optional_package_media collides with a ledger-only legacy id')), result.failures.join('\n'))
})

test('runner contract drift is reported (guard must be revisited if migrate.ts stops filename-sorting)', () => {
  const drifted = runnerSource.replace(/\.sort\(\)/, '.sort((a, b) => Number(a.slice(0, 3)) - Number(b.slice(0, 3)))')
  assert.notEqual(drifted, runnerSource)
  const result = checkMigrations({files: mainFiles, read: readMain, runnerSource: drifted})
  assert.deepEqual(result.failures, ['listMigrationFiles() no longer uses default filename sort; revisit this guard'])
})
