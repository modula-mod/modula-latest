#!/usr/bin/env node
import {existsSync, readFileSync, readdirSync, rmSync, statSync} from 'node:fs'
import {basename, join, resolve} from 'node:path'

const root = resolve(process.env.MODULA_RECOVERY_OUTPUT_ROOT ?? '/var/backups/modula/greenfield-v1')
const apply = process.argv.includes('--apply')
if (!root.startsWith('/') || ['/', '/root', '/var', '/tmp', '/var/backups'].includes(root)) throw new Error('retention root must be a dedicated absolute path')
if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error('retention root does not exist')

const sets = readdirSync(root, {withFileTypes: true})
  .filter(entry => entry.isDirectory() && /^gbv1-recovery-\d{8}T\d{9}Z$/.test(entry.name))
  .map(entry => {
    const path = join(root, entry.name)
    const manifestPath = join(path, 'manifest.json')
    if (!existsSync(manifestPath)) throw new Error(`backup set has no manifest: ${entry.name}`)
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    if (manifest.backupSetId !== entry.name || manifest.format !== 'modula.greenfield.recovery.v1') throw new Error(`invalid backup set: ${entry.name}`)
    return {name: entry.name, path, createdAt: new Date(manifest.createdAt)}
  })
  .sort((a, b) => b.createdAt - a.createdAt)

const keep = new Set()
for (const value of sets.slice(0, 14)) keep.add(value.name)
keepBuckets(sets.slice(14), 8, value => isoWeek(value.createdAt))
keepBuckets(sets.slice(14), 12, value => value.createdAt.toISOString().slice(0, 7))
const remove = sets.filter(value => !keep.has(value.name))

for (const value of remove) {
  if (basename(value.path) !== value.name || !value.path.startsWith(`${root}/`)) throw new Error('retention target escaped root')
  if (apply) rmSync(value.path, {recursive: true, force: false})
}
process.stdout.write(`${JSON.stringify({ok: true, mode: apply ? 'apply' : 'dry-run', total: sets.length, kept: [...keep].sort(), removed: remove.map(value => value.name)})}\n`)

function keepBuckets(values, max, keyFor) {
  const used = new Set()
  for (const value of values) {
    const key = keyFor(value)
    if (used.has(key) || used.size >= max) continue
    used.add(key)
    keep.add(value.name)
  }
}

function isoWeek(date) {
  const value = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7))
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1))
  return `${value.getUTCFullYear()}-W${String(Math.ceil((((value - yearStart) / 86400000) + 1) / 7)).padStart(2, '0')}`
}
