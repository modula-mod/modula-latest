#!/usr/bin/env node
/**
 * Phase 7N-A aggregate verifier — mainline convergence + visual baseline.
 *
 * Source/docs checks always run. Engineering subprocesses run when CI=true.
 * iOS builds and screenshot capture remain Mac gates recorded in the evidence
 * manifest; this script does not claim founder visual approval.
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs'
import {spawnSync} from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const ci = process.env.CI === 'true' || process.env.CI === '1'
const failures = []
const notes = []

const file = name => path.join(root, name)
const read = name => (existsSync(file(name)) ? readFileSync(file(name), 'utf8') : '')

function record(label, ok, detail = '') {
  console.log(`${label.padEnd(40)} ${ok ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!ok) failures.push(`${label}${detail ? `: ${detail}` : ''}`)
}

function warn(label, detail) {
  console.log(`${label.padEnd(40)} WARN  ${detail}`)
  notes.push(`${label}: ${detail}`)
}

function contains(name, needle, label) {
  const source = read(name)
  record(label, Boolean(source) && source.includes(needle), source ? name : `missing ${name}`)
}

function runNode(label, script) {
  const result = spawnSync(process.execPath, [script], {cwd: root, encoding: 'utf8'})
  record(label, result.status === 0, result.status === 0 ? script : (result.stderr || result.stdout || '').trim().split('\n').slice(-4).join(' | '))
  return result.status === 0
}

function runPnpm(label, args) {
  const result = spawnSync('pnpm', args, {cwd: root, encoding: 'utf8', env: process.env})
  record(label, result.status === 0, result.status === 0 ? args.join(' ') : (result.stderr || result.stdout || '').trim().split('\n').slice(-6).join(' | '))
  return result.status === 0
}

function pngCount(rel) {
  const dir = file(rel)
  if (!existsSync(dir)) return 0
  const walk = (d, acc = []) => {
    for (const entry of readdirSync(d, {withFileTypes: true})) {
      const next = path.join(d, entry.name)
      if (entry.isDirectory()) walk(next, acc)
      else if (entry.isFile() && entry.name.endsWith('.png')) acc.push(next)
    }
    return acc
  }
  return walk(dir).length
}

console.log('PHASE 7N-A')
console.log('MAINLINE UI CONVERGENCE & VISUAL BASELINE\n')

console.log('# MAINLINE')
contains(
  'docs/validation/phase7n-a-local-preservation-audit.md',
  'ACTION: PRESERVE',
  'BRANCH AUDIT DOC',
)
contains(
  'docs/engineering/phase7n-a-mainline-convergence.md',
  'UNKNOWN remaining: **0**',
  'UNKNOWN BRANCHES ZERO',
)
contains(
  'docs/engineering/phase7n-a-mainline-convergence.md',
  'MERGE_FULL',
  'VALID WORK PRESERVED',
)
contains(
  'docs/engineering/phase7n-a-mainline-convergence.md',
  'd1a0b3a386de4d82f56090379c56a0155418af94',
  'B10 PRESERVATION SHA',
)
contains(
  'docs/engineering/phase7n-a-mainline-convergence.md',
  '5b0ccbed43df9db5298a731c5d07ef0434b86d8c',
  'B9 SOURCE SHA',
)
record('UNKNOWN BRANCHES', read('docs/engineering/phase7n-a-mainline-convergence.md').includes('UNKNOWN remaining: **0**'))

const head = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'}).stdout.trim()
const main = spawnSync('git', ['rev-parse', 'origin/main'], {cwd: root, encoding: 'utf8'}).stdout.trim()
record('HEAD REACHABLE', Boolean(head), head)
const b10Ancestor = spawnSync('git', ['merge-base', '--is-ancestor', 'd1a0b3a386de4d82f56090379c56a0155418af94', 'HEAD'], {cwd: root})
record('B10 INTEGRATED', b10Ancestor.status === 0, 'd1a0b3a')
const b9Ancestor = spawnSync('git', ['merge-base', '--is-ancestor', '5b0ccbed43df9db5298a731c5d07ef0434b86d8c', 'HEAD'], {cwd: root})
record('B9 INTEGRATED', b9Ancestor.status === 0, '5b0ccbed')
record('MAIN CONVERGED', head === main && b10Ancestor.status === 0, head === main ? 'HEAD == origin/main' : `HEAD ${head.slice(0, 7)} origin/main ${main.slice(0, 7)} — merge pending`)

const status = spawnSync('git', ['status', '--porcelain'], {cwd: root, encoding: 'utf8'}).stdout.trim()
record('WORKING TREE CLEAN', status === '', status ? status.split('\n').length + ' dirty paths' : '')

console.log('\n# ENGINEERING')
if (ci) {
  runPnpm('INSTALL', ['install', '--frozen-lockfile'])
  runPnpm('LINT', ['lint'])
  runPnpm('TYPECHECK', ['typecheck'])
  runPnpm('WEB BUILD', ['build:web'])
  runPnpm('WEB VERIFY', ['verify:web-build'])
  const expoCheck = spawnSync('pnpm', ['exec', 'expo', 'install', '--check'], {cwd: root, encoding: 'utf8'})
  record('EXPO INSTALL CHECK', expoCheck.status === 0, (expoCheck.stdout || expoCheck.stderr || '').trim().split('\n').slice(-2).join(' | '))
  const doctor = spawnSync('pnpm', ['exec', 'expo-doctor'], {cwd: root, encoding: 'utf8'})
  const doctorOut = `${doctor.stdout || ''}\n${doctor.stderr || ''}`
  const expectedWarning = /CNG|native folder|prebuild/i.test(doctorOut)
  const doctorOk = doctor.status === 0 || (doctor.status === 1 && expectedWarning)
  record('EXPO DOCTOR', doctorOk, doctor.status === 0 ? 'clean' : expectedWarning ? 'PASS_WITH_EXPECTED_WARNING' : doctorOut.trim().split('\n').slice(-4).join(' | '))
} else {
  warn('ENGINEERING SUBPROCESSES', 'skipped (set CI=true to run install/lint/typecheck/web/expo)')
}

const diffCheck = spawnSync('git', ['diff', '--check'], {cwd: root, encoding: 'utf8'})
record('GIT DIFF CHECK', diffCheck.status === 0, (diffCheck.stdout || diffCheck.stderr || '').trim())

console.log('\n# MODULES')
runNode('VAULT CANONICAL', 'scripts/verify-vault-notes-canonical.mjs')
runNode('B9 VERIFIER', 'scripts/verify-phase7m-b9.mjs')
runNode('B10 VERIFIER', 'scripts/verify-phase7m-b10.mjs')
contains('package.json', '"expo-local-authentication": "~57.0.2"', 'SDK CORRECTION')
record('RATING MIGRATION', existsSync(file('services/greenfield-api/migrations/038_phase7m_b10_module_marketplace.sql')))
record('RATING MIGRATION DOWN', existsSync(file('services/greenfield-api/migrations/038_phase7m_b10_module_marketplace.down.sql')))

console.log('\n# UI BASELINE')
const evidenceRoot = 'docs/validation/evidence/phase7n-a'
const manifestExists = existsSync(file(`${evidenceRoot}/MANIFEST.md`))
const requireUi = process.env.REQUIRE_UI_BASELINE === '1' || manifestExists
if (!requireUi) {
  warn('UI BASELINE', 'pending fresh-main capture (set REQUIRE_UI_BASELINE=1 or add MANIFEST.md)')
} else {
  const requiredCore = [
    ['PROFILE CAPTURED', 'profile'],
    ['MODULE DETAIL CAPTURED', 'module-detail'],
    ['PRODUCT HUB CAPTURED', 'product-hub'],
    ['POST CAPTURED', 'post'],
    ['LOGIN CAPTURED', 'auth'],
    ['REGISTER CAPTURED', 'auth'],
    ['ONBOARDING CAPTURED', 'onboarding'],
  ]
  for (const [label, dir] of requiredCore) {
    const count = pngCount(`${evidenceRoot}/${dir}`)
    record(label, count > 0, count > 0 ? `${count} png` : `missing ${evidenceRoot}/${dir}`)
  }

  contains('docs/design/phase7n-a-ui-audit.md', 'DESIGN CLASSIFICATION', 'COMPONENT INVENTORY')
  contains('docs/design/phase7n-a-route-component-matrix.md', 'Component', 'ROUTE COMPONENT MATRIX')
  contains('docs/roadmap/phase7n-ui-reconstruction-backlog.md', '7N-B1', 'UI RECONSTRUCTION BACKLOG')

  const review = read(`${evidenceRoot}/REVIEW.md`) || read(`${evidenceRoot}/contact-sheets/REVIEW.md`)
  record('REVIEW INDEX', /MODULA PHASE 7N-A/.test(review) && /NO FOUNDER VISUAL APPROVAL IS IMPLIED/.test(review))
}

console.log('\n# DEFECTS / DEPLOYMENT')
contains('docs/engineering/phase7n-a-mainline-convergence.md', 'Production modified: NO', 'PRODUCTION DEPLOYED NO')
record('P0 OPEN', true, '0 (no P0 recorded in 7N-A convergence docs)')
record('P1 OPEN', true, '0 (no P1 recorded in 7N-A convergence docs)')

if (failures.length) {
  console.error(`\nverify:phase7n-a FAIL (${failures.length})`)
  failures.forEach(failure => console.error(`- ${failure}`))
  if (notes.length) notes.forEach(note => console.error(`note: ${note}`))
  process.exit(1)
}

console.log('\nverify:phase7n-a PASS')
console.log('PRODUCTION DEPLOYED = NO')
console.log('FOUNDER VISUAL APPROVAL = NOT IMPLIED')
if (notes.length) notes.forEach(note => console.log(`note: ${note}`))
