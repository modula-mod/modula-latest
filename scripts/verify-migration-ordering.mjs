#!/usr/bin/env node
/**
 * GF-SIGN-02: repository guard for GreenField migration numbering and order.
 *
 * The runner (services/greenfield-api/src/database/migrate.ts, listMigrationFiles)
 * keeps every `*.sql` file whose name does not contain `.down.` and applies them
 * in plain `Array.prototype.sort()` order, i.e. by UTF-16 filename order, not by
 * numeric prefix. Two files that share a prefix therefore apply in name order
 * (089_greenfield_* before 089_messaging_v3), and a branch that lands a lower
 * number after a higher one has already been applied is silently skipped on
 * fresh installs but never applied on upgraded databases in the same order.
 *
 * This verifier does not change runner behaviour. It fails when:
 *   - a migration filename does not match NNN_lower_snake[.down].sql
 *   - two up migrations share a numeric prefix
 *   - up migrations are not exactly 001..N with no gap
 *   - an up migration has no .down pair, or a .down has no up migration
 *   - a file id collides with a ledger-only legacy id in the runner
 *   - a migration that writes schema_metadata.schema_version writes a value
 *     other than its own prefix (up) or the previous prefix (down)
 *   - the tip migration does not write schema_version
 *   - the runner no longer uses the filename-sort contract this guard models
 *   - with a base (--base-ref <git-ref> or --base-dir <dir>): a base migration
 *     was removed/renamed, or a new migration does not sort after the base tip
 *
 * Usage:
 *   node scripts/verify-migration-ordering.mjs
 *   node scripts/verify-migration-ordering.mjs --base-ref origin/main
 *   node scripts/verify-migration-ordering.mjs --dir <migrations> --base-dir <dir> --runner <migrate.ts>
 */
import {execFileSync} from 'node:child_process'
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

export const DEFAULT_MIGRATIONS_DIR = 'services/greenfield-api/migrations'
export const DEFAULT_RUNNER = 'services/greenfield-api/src/database/migrate.ts'
const FILE_PATTERN = /^(\d{3})_[a-z0-9]+(?:_[a-z0-9]+)*(\.down)?\.sql$/
const SCHEMA_VERSION_WRITE = /'schema_version'\s*,\s*'(\d{3})'/g

/** Mirrors listMigrationFiles(): up files, default sort, `.sql` stripped. */
export function runnerOrder(fileNames) {
  return fileNames
    .filter(name => name.endsWith('.sql') && !name.includes('.down.'))
    .sort()
    .map(name => name.replace(/\.sql$/, ''))
}

export function parseLegacyIds(runnerSource) {
  const match = /KNOWN_LEGACY_MIGRATIONS\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(runnerSource ?? '')
  if (!match) return []
  return [...match[1].matchAll(/'([^']+)'/g)].map(item => item[1])
}

export function runnerContractProblems(runnerSource) {
  const problems = []
  if (typeof runnerSource !== 'string') return ['migration runner source not found']
  const body = /export async function listMigrationFiles[\s\S]*?\n}\n/.exec(runnerSource)?.[0]
  if (!body) return ['listMigrationFiles() not found in migration runner']
  if (!body.includes(".filter(name => name.endsWith('.sql') && !name.includes('.down.'))")) {
    problems.push('listMigrationFiles() no longer filters `.sql` minus `.down.`; revisit this guard')
  }
  if (!/\.sort\(\)/.test(body)) {
    problems.push('listMigrationFiles() no longer uses default filename sort; revisit this guard')
  }
  return problems
}

/**
 * @param {object} input
 * @param {string[]} input.files          names in the migrations directory
 * @param {(name: string) => string} [input.read]  file contents reader
 * @param {string} [input.runnerSource]   migrate.ts source
 * @param {string[] | null} [input.baseFiles] names in the base revision's directory
 */
export function checkMigrations({files, read = () => '', runnerSource, baseFiles = null}) {
  const failures = []
  const notes = []
  const fail = message => failures.push(message)

  for (const problem of runnerContractProblems(runnerSource)) fail(problem)

  const ups = new Map()
  const downs = new Map()
  for (const name of [...files].sort()) {
    const match = FILE_PATTERN.exec(name)
    if (!match) {
      fail(`unexpected file in migrations directory (want NNN_lower_snake[.down].sql): ${name}`)
      continue
    }
    const [, prefix, down] = match
    const id = name.replace(/(\.down)?\.sql$/, '')
    const bucket = down ? downs : ups
    if (!bucket.has(prefix)) bucket.set(prefix, [])
    bucket.get(prefix).push(id)
  }

  for (const [prefix, ids] of ups) {
    if (ids.length > 1) fail(`duplicate up-migration prefix ${prefix}: ${ids.join(', ')} (runner would apply them in filename order)`)
  }
  for (const [prefix, ids] of downs) {
    if (ids.length > 1) fail(`duplicate down-migration prefix ${prefix}: ${ids.join(', ')}`)
  }

  const prefixes = [...ups.keys()].map(Number).sort((a, b) => a - b)
  const tip = prefixes.at(-1) ?? 0
  for (let n = 1; n <= tip; n += 1) {
    if (!ups.has(pad(n))) fail(`gap in migration sequence: no up migration ${pad(n)} before tip ${pad(tip)}`)
  }

  for (const [prefix, ids] of ups) {
    for (const id of ids) {
      if (!(downs.get(prefix) ?? []).includes(id)) fail(`up migration without .down pair: ${id}.sql (expected ${id}.down.sql)`)
    }
  }
  for (const [prefix, ids] of downs) {
    for (const id of ids) {
      if (!(ups.get(prefix) ?? []).includes(id)) fail(`.down migration without up migration: ${id}.down.sql`)
    }
  }

  const order = runnerOrder(files.filter(name => FILE_PATTERN.test(name)))
  const numeric = [...order].sort((a, b) => Number(a.slice(0, 3)) - Number(b.slice(0, 3)) || (a < b ? -1 : a > b ? 1 : 0))
  if (order.join('\n') !== numeric.join('\n')) fail('runner filename order differs from numeric order')

  const legacy = new Set(parseLegacyIds(runnerSource))
  for (const id of order) {
    if (legacy.has(id)) fail(`file id ${id} collides with a ledger-only legacy id in KNOWN_LEGACY_MIGRATIONS; the runner would treat it as already applied`)
  }

  for (const [prefix, ids] of ups) {
    for (const id of ids) {
      const written = schemaVersionWrites(read(`${id}.sql`))
      for (const value of written) {
        if (value !== prefix) fail(`${id}.sql writes schema_version '${value}', expected '${prefix}'`)
      }
      if (Number(prefix) === tip && ids.length === 1 && written.length === 0) {
        fail(`tip migration ${id}.sql does not write schema_metadata schema_version '${prefix}'`)
      }
    }
  }
  for (const [prefix, ids] of downs) {
    const previous = pad(Number(prefix) - 1)
    for (const id of ids) {
      for (const value of schemaVersionWrites(read(`${id}.down.sql`))) {
        if (value !== previous) fail(`${id}.down.sql writes schema_version '${value}', expected previous '${previous}'`)
      }
    }
  }

  if (baseFiles) {
    const baseOrder = runnerOrder(baseFiles.filter(name => FILE_PATTERN.test(name)))
    const current = new Set(order)
    for (const id of baseOrder) {
      if (!current.has(id)) fail(`base migration removed or renamed: ${id} (applied migrations are immutable)`)
    }
    const baseTip = baseOrder.at(-1)
    const baseSet = new Set(baseOrder)
    const added = order.filter(id => !baseSet.has(id))
    for (const id of added) {
      if (baseTip && !(id > baseTip)) fail(`new migration ${id} sorts before base tip ${baseTip}; the runner sorts by filename (renumber after ${baseTip})`)
    }
    notes.push(`base tip ${baseTip ?? '(none)'}; new migrations: ${added.join(', ') || '(none)'}`)
  }

  notes.push(`up migrations: ${order.length}; tip: ${order.at(-1) ?? '(none)'}`)
  return {ok: failures.length === 0, failures, notes, tip: order.at(-1) ?? null}
}

function schemaVersionWrites(sql) {
  return [...String(sql ?? '').matchAll(SCHEMA_VERSION_WRITE)].map(match => match[1])
}

function pad(value) {
  return String(value).padStart(3, '0')
}

function parseArgs(argv) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]
    if (!['--dir', '--runner', '--base-ref', '--base-dir'].includes(key) || argv[index + 1] === undefined) {
      console.error('usage: verify-migration-ordering.mjs [--dir <dir>] [--runner <migrate.ts>] [--base-ref <git-ref> | --base-dir <dir>]')
      process.exit(2)
    }
    args[key.slice(2)] = argv[index + 1]
    index += 1
  }
  return args
}

function baseFilesFromRef(ref, dir) {
  const output = execFileSync('git', ['ls-tree', '--name-only', ref, '--', `${dir.replace(/\/$/, '')}/`], {encoding: 'utf8'})
  return output.split('\n').filter(Boolean).map(path => path.split('/').at(-1))
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const dir = args.dir ?? DEFAULT_MIGRATIONS_DIR
  const runnerPath = args.runner ?? DEFAULT_RUNNER
  const baseRef = args['base-ref'] ?? process.env.MIGRATION_ORDER_BASE_REF ?? ''
  const files = readdirSync(dir)
  const runnerSource = existsSync(runnerPath) ? readFileSync(runnerPath, 'utf8') : undefined
  let baseFiles = null
  if (args['base-dir']) baseFiles = readdirSync(args['base-dir'])
  else if (baseRef) baseFiles = baseFilesFromRef(baseRef, dir)
  const result = checkMigrations({files, read: name => readFileSync(join(dir, name), 'utf8'), runnerSource, baseFiles})
  for (const note of result.notes) console.log(`INFO ${note}`)
  if (!result.ok) {
    for (const failure of result.failures) console.error(`FAIL ${failure}`)
    console.error(`Migration ordering verifier failed: ${result.failures.length} issue(s)`)
    process.exit(1)
  }
  console.log('Migration ordering verifier passed')
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
