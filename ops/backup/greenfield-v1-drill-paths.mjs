/**
 * GF-OPS-02: staging-path containment for the restore drill.
 *
 * The drill pulls and decrypts a production recovery set, so its staging directory must be a
 * strict descendant of one dedicated drill root (MODULA_RESTORE_DRILL_ROOT, default
 * /var/lib/modula/restore-drill). Containment is decided on resolved, symlink-resolved paths
 * with path.relative, never by substring or prefix matching, so `..` traversal, sibling-prefix
 * tricks (/var/lib/modula/restore-drill-evil) and symlinks that leave the root are refused.
 */
import {existsSync, realpathSync} from 'node:fs'
import {basename, dirname, isAbsolute, join, relative, resolve, sep} from 'node:path'

export const DEFAULT_DRILL_ROOT = '/var/lib/modula/restore-drill'
const BROAD = new Set(['/', '/root', '/home', '/etc', '/opt', '/srv', '/usr', '/tmp', '/var', '/var/tmp', '/var/lib', '/var/lib/modula', '/var/backups', '/var/backups/modula'])
const DRILL_NAME = /(^|[._-])(restore|recovery|dr|drill|test)([._-]|$)/i

function fail(message) {
  throw new Error(message)
}

/** Resolve symlinks of the deepest existing ancestor and append the not-yet-created remainder. */
export function realpathAllowMissing(path) {
  let current = resolve(path)
  const rest = []
  while (!existsSync(current)) {
    const parent = dirname(current)
    if (parent === current) break
    rest.unshift(basename(current))
    current = parent
  }
  return join(realpathSync(current), ...rest)
}

export function isInside(child, parent) {
  const rel = relative(parent, child)
  return rel !== '' && rel !== '..' && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)
}

/**
 * Returns the resolved staging directory or throws.
 * @param {string} staging requested staging dir (relative paths resolve against cwd)
 * @param {{root?: string, avoid?: string[]}} options avoid: paths the staging dir must not overlap
 */
export function resolveDrillStaging(staging, {root = DEFAULT_DRILL_ROOT, avoid = []} = {}) {
  if (typeof staging !== 'string' || !staging.trim()) fail('restore drill staging path is required')
  if (typeof root !== 'string' || !isAbsolute(root)) fail('MODULA_RESTORE_DRILL_ROOT must be an absolute path')
  const rootResolved = resolve(root)
  if (BROAD.has(rootResolved)) fail(`MODULA_RESTORE_DRILL_ROOT must be a dedicated directory, not ${rootResolved}`)
  if (!DRILL_NAME.test(basename(rootResolved))) fail('MODULA_RESTORE_DRILL_ROOT name must identify a restore drill directory (restore/recovery/dr/drill/test as a name segment)')
  const rootReal = realpathAllowMissing(rootResolved)
  if (BROAD.has(rootReal)) fail('MODULA_RESTORE_DRILL_ROOT resolves to a broad system directory')
  const target = realpathAllowMissing(staging)
  if (!isInside(target, rootReal)) fail('restore drill staging path must be strictly inside MODULA_RESTORE_DRILL_ROOT')
  for (const path of avoid.filter(Boolean)) {
    const other = realpathAllowMissing(path)
    if (target === other || isInside(target, other) || isInside(other, target)) fail('restore drill staging path overlaps a protected path')
  }
  return target
}
