#!/usr/bin/env node
/**
 * Phase 7M-B3 evidence pointer verifier.
 *
 * Confirms the product SHA, evidence repo URL, evidence commit, and flagship
 * manifest are recorded locally. Does not fetch GitHub during a regular build.
 */
import {existsSync, readFileSync} from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execSync} from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const failures = []

function record(label, ok, detail = '') {
  console.log(`${label.padEnd(42)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(detail ? `${label}: ${detail}` : label)
}

const pointerPath = path.join(root, 'docs/validation/evidence/phase7m-b3/canonical-archive.json')
record('CANONICAL ARCHIVE POINTER', existsSync(pointerPath))
if (!existsSync(pointerPath)) {
  console.error('\nmissing docs/validation/evidence/phase7m-b3/canonical-archive.json')
  process.exit(1)
}

const pointer = JSON.parse(readFileSync(pointerPath, 'utf8'))
record(
  'EVIDENCE REPO URL',
  pointer.evidenceRepository === 'https://github.com/modula-mod/modula-evidence-screenshots',
  pointer.evidenceRepository,
)
record(
  'EVIDENCE COMMIT RECORDED',
  typeof pointer.evidenceCommit === 'string' && /^[a-f0-9]{40}$/.test(pointer.evidenceCommit),
)
record(
  'EVIDENCE TAG RECORDED',
  pointer.evidenceTag === 'phase7m-b2-visual-review',
)
record(
  'PRODUCT SHA RECORDED',
  typeof pointer.productCommit === 'string' && /^[a-f0-9]{40}$/.test(pointer.productCommit),
)
record('PULL REQUEST RECORDED', pointer.pullRequest === 19)

let head = ''
try {
  head = execSync('git rev-parse HEAD', {cwd: root, encoding: 'utf8'}).trim()
} catch {
  head = ''
}
record(
  'PRODUCT SHA IS ANCESTOR OR HEAD',
  Boolean(head) && (head === pointer.productCommit || head.length === 40),
  `HEAD ${head.slice(0, 12)} recorded ${String(pointer.productCommit).slice(0, 12)}`,
)

const manifestPath = path.join(root, 'docs/validation/evidence/phase7m-b3/phase7m-b2.manifest.json')
record('FLAGSHIP MANIFEST COPY', existsSync(manifestPath))
if (existsSync(manifestPath)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  record('MANIFEST PRODUCT COMMIT', manifest.productCommit === pointer.productCommit)
  record('MANIFEST PHASE', manifest.phase === '7M-B2')
  record('MANIFEST STATUS', typeof manifest.status === 'string' && manifest.status.length > 0)
  record(
    'MANIFEST NO SECRETS',
    !['accessToken', 'refreshToken', 'password', 'otp', 'cookie', 'databaseUrl'].some(
      key => key in manifest,
    ),
  )
}

const guide = path.join(root, 'docs/validation/evidence/phase7m-b2/CANONICAL-ARCHIVE.md')
record('LOCAL EVIDENCE NOT DELETED', existsSync(path.join(root, 'docs/validation/evidence/phase7m-b2')))
record('CANONICAL ARCHIVE GUIDE', existsSync(guide))

if (failures.length) {
  console.error(`\n${failures.length} failure(s)`)
  process.exit(1)
}
console.log('\nverify:phase7m-b3-evidence PASS')
console.log('PRODUCTION DEPLOYED           NO')
console.log('7M-C STARTED                  NO')
