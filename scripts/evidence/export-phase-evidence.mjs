#!/usr/bin/env node
/**
 * Stage Modula visual evidence for the canonical archive.
 *
 * Collects selected files, validates names, hashes them, rejects forbidden
 * patterns, and writes a staging directory. Never pushes. Pass --push to
 * receive an explicit refusal plus the git commands to run by hand.
 */
import {createHash} from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const args = process.argv.slice(2)

function flag(name, fallback = null) {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? true
}

const phase = String(flag('--phase', '7m-b2'))
const fromDir = path.resolve(String(flag('--from', path.join(root, 'docs/validation/evidence/phase7m-b2'))))
const stageDir = path.resolve(String(flag('--stage', path.join(root, '.staging/evidence', phase))))
const wantPush = args.includes('--push')

const FORBIDDEN_EXT = new Set(['.env', '.pem', '.key', '.p12', '.sql', '.sqlite', '.dump', '.har'])
const FORBIDDEN_NAME = /(\.env|credentials|secrets|id_rsa|otp-code|access.?token)/i
const MEDIA_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.mp4', '.mov'])
const NAME_RE =
  /^(7m-b2-(ios|web)-[a-z0-9-]+-\d{2}|7m-b2-motion-[a-z0-9-]+-\d{2}|7m-b2-contact-sheet-[a-z0-9-]+-\d{2})\.(png|jpe?g|webp|gif|mp4|mov)$/i

function walk(dir, acc = []) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, acc)
    else acc.push(full)
  }
  return acc
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

if (wantPush) {
  console.error('Export never pushes. Stage the files, then commit in the evidence clone yourself:')
  console.error('  cd ../modula-evidence-screenshots && git add ... && git commit && git push origin main')
  process.exit(2)
}

if (!existsSync(fromDir)) {
  console.error(`Source directory missing: ${fromDir}`)
  process.exit(1)
}

mkdirSync(stageDir, {recursive: true})
const failures = []
const files = []

for (const file of walk(fromDir)) {
  const rel = path.relative(fromDir, file).split(path.sep).join('/')
  const ext = path.extname(file).toLowerCase()
  const base = path.basename(file)
  if (FORBIDDEN_EXT.has(ext) || FORBIDDEN_NAME.test(rel)) {
    failures.push(`forbidden ${rel}`)
    continue
  }
  if (!MEDIA_EXT.has(ext) && !rel.endsWith('.md') && !rel.endsWith('.json')) continue
  if (MEDIA_EXT.has(ext) && statSync(file).size === 0) {
    failures.push(`zero-byte ${rel}`)
    continue
  }
  const dest = path.join(stageDir, rel)
  mkdirSync(path.dirname(dest), {recursive: true})
  copyFileSync(file, dest)
  files.push({
    path: rel,
    bytes: statSync(file).size,
    sha256: MEDIA_EXT.has(ext) ? sha256(file) : null,
    namingOk: !MEDIA_EXT.has(ext) || NAME_RE.test(base) || /REJECTED/i.test(base),
  })
}

const manifest = {
  phase,
  stagedAt: new Date().toISOString(),
  sourceDir: fromDir,
  stageDir,
  files,
  note: 'Staging only. This helper does not push to GitHub.',
}

writeFileSync(path.join(stageDir, 'export-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

const badNames = files.filter(row => row.sha256 && row.namingOk === false)
if (badNames.length) {
  console.warn(`Warning: ${badNames.length} media file(s) do not use the canonical capture name. Rename before publishing.`)
  for (const row of badNames) console.warn(`  ${row.path}`)
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(`Staged ${files.length} file(s) at ${stageDir}`)
console.log('Next: copy accepted, renamed, sanitized files into modula-evidence-screenshots. Do not push from this script.')
)
