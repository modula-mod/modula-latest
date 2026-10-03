#!/usr/bin/env node
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import {extname, join, relative} from 'node:path'
import {outputDir, repoRoot} from './lib.mjs'

const required = [
  'README.md', '00-executive-summary.md', '00-production-truth.md', '01-application-boot-map.md',
  '02-http-api-atlas.md', '03-auth-permissions-matrix.md', '04-database-api-map.md',
  '05-media-storage-map.md', '06-module-platform-map.md', '07-intelligence-api-map.md',
  '08-events-workers-jobs.md', '09-client-capability-coverage.md', '10-live-probe-results.md',
  '11-gap-register.md', '12-remediation-roadmap.md', 'api-atlas.json', 'api-atlas.csv',
  '13-verification-results.md',
  'route-data-map.json', 'gap-register.json', 'openapi.generated.yaml', 'request-flow.mmd',
  'module-flow.mmd', 'intelligence-flow.mmd', 'media-flow.mmd', 'event-flow.mmd',
  'client-contract-analysis.json', 'evidence/production-snapshot.json', 'evidence/live-probes.json',
  'evidence/source-sweep.json',
]

const failures = []
const checks = []

function check(name, condition, details = '') {
  checks.push({name, ok: Boolean(condition), details})
  if (!condition) failures.push(`${name}${details ? `: ${details}` : ''}`)
}

function filesUnder(path) {
  const output = []
  for (const name of readdirSync(path)) {
    const target = join(path, name)
    if (statSync(target).isDirectory()) output.push(...filesUnder(target))
    else output.push(target)
  }
  return output
}

function hashes() {
  return Object.fromEntries(filesUnder(outputDir).sort().map(file => [relative(outputDir, file), createHash('sha256').update(readFileSync(file)).digest('hex')]))
}

function parseCsv(text) {
  const rows = []
  let row = []
  let value = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { value += '"'; index += 1 }
      else if (char === '"') quoted = false
      else value += char
    } else if (char === '"') quoted = true
    else if (char === ',') { row.push(value); value = '' }
    else if (char === '\n') { row.push(value); rows.push(row); row = []; value = '' }
    else if (char !== '\r') value += char
  }
  if (value || row.length) { row.push(value); rows.push(row) }
  if (quoted) throw new Error('unterminated quoted CSV field')
  return rows
}

for (const name of required) check(`required artifact ${name}`, existsSync(join(outputDir, name)))

const before = hashes()
execFileSync(process.execPath, [join(repoRoot, 'tools/api-atlas/generate.mjs')], {cwd: repoRoot, stdio: 'pipe'})
const once = hashes()
execFileSync(process.execPath, [join(repoRoot, 'tools/api-atlas/generate.mjs')], {cwd: repoRoot, stdio: 'pipe'})
const twice = hashes()
check('deterministic output', JSON.stringify(once) === JSON.stringify(twice), 'two consecutive generator runs must be byte-identical')
check('generator does not drop prior artifacts', Object.keys(before).every(name => name in twice))

let atlas
let gaps
let routeData
let snapshot
let probes
let clientContracts
let openapi
try { atlas = JSON.parse(readFileSync(join(outputDir, 'api-atlas.json'), 'utf8')); check('api-atlas.json parses', true) } catch (error) { check('api-atlas.json parses', false, error.message) }
try { gaps = JSON.parse(readFileSync(join(outputDir, 'gap-register.json'), 'utf8')); check('gap-register.json parses', true) } catch (error) { check('gap-register.json parses', false, error.message) }
try { routeData = JSON.parse(readFileSync(join(outputDir, 'route-data-map.json'), 'utf8')); check('route-data-map.json parses', true) } catch (error) { check('route-data-map.json parses', false, error.message) }
try { snapshot = JSON.parse(readFileSync(join(outputDir, 'evidence/production-snapshot.json'), 'utf8')); check('production snapshot parses', true) } catch (error) { check('production snapshot parses', false, error.message) }
try { probes = JSON.parse(readFileSync(join(outputDir, 'evidence/live-probes.json'), 'utf8')); check('live probes parse', true) } catch (error) { check('live probes parse', false, error.message) }
try { clientContracts = JSON.parse(readFileSync(join(outputDir, 'client-contract-analysis.json'), 'utf8')); check('client contract analysis parses', true) } catch (error) { check('client contract analysis parses', false, error.message) }
try { openapi = JSON.parse(readFileSync(join(outputDir, 'openapi.generated.yaml'), 'utf8')); check('OpenAPI YAML parses as JSON-compatible YAML', true) } catch (error) { check('OpenAPI YAML parses as JSON-compatible YAML', false, error.message) }

if (atlas && snapshot) {
  const reconciliation = atlas.reconciliation
  check('runtime route equation', reconciliation.runtimeMethodRoutes === reconciliation.applicationRuntimeRoutes + reconciliation.explicitlyExcludedFrameworkRoutes, JSON.stringify(reconciliation))
  check('every application route mapped', reconciliation.mappedApplicationRoutes === reconciliation.applicationRuntimeRoutes && reconciliation.runtimeOnlyRoutes === 0)
  check('no source-only route', reconciliation.sourceOnlyRoutes === 0)
  check('no duplicate source route', reconciliation.duplicates.length === 0)
  check('route count matches runtime snapshot', reconciliation.runtimeMethodRoutes === snapshot.runtimeRoutes.length)
  check('unique route IDs', new Set(atlas.routes.map(route => route.id)).size === atlas.routes.length)
  check('effective prefixes resolved', atlas.routes.every(route => route.effectiveRoute === '*' || route.effectiveRoute.startsWith('/')))
  check('every route has source evidence', atlas.routes.every(route => route.source?.file && Number.isInteger(route.source.line)))
  check('every route has auth classification', atlas.routes.every(route => typeof route.authorization?.visibility === 'string' && typeof route.authorization?.sessionRequired === 'boolean'))
  check('every route has ownership disposition', atlas.routes.every(route => typeof route.authorization?.ownership?.rule === 'string'))
  check('every route is represented in route-data map', atlas.routes.every(route => route.id in routeData))
  check('OpenAPI operation count', Object.values(openapi.paths).reduce((count, path) => count + Object.keys(path).length, 0) === atlas.routes.length)
}

if (gaps) {
  check('gap IDs unique', new Set(gaps.gaps.map(gap => gap.id)).size === gaps.gaps.length)
  check('gap schema complete', gaps.gaps.every(gap => ['id','domain','type','severity','title','evidence','affectedRoutes','affectedFiles','productionImpact','recommendedFix','dependencies','verification'].every(key => key in gap)))
  check('gap severities valid', gaps.gaps.every(gap => ['P0','P1','P2','P3'].includes(gap.severity)))
}

if (probes) check('safe probe suite passed', probes.probes.length > 0 && probes.probes.every(probe => probe.result === 'PASS'))
if (clientContracts) check('literal client calls reconciled', clientContracts.unmatched.length === 0)

try {
  const csv = parseCsv(readFileSync(join(outputDir, 'api-atlas.csv'), 'utf8'))
  const widths = new Set(csv.map(row => row.length))
  check('CSV parses with stable columns', widths.size === 1, `row widths ${[...widths].join(',')}`)
  if (atlas) check('CSV route count', csv.length - 1 === atlas.routes.length)
} catch (error) { check('CSV parses', false, error.message) }

for (const file of required.filter(name => extname(name) === '.mmd')) {
  const text = readFileSync(join(outputDir, file), 'utf8')
  check(`Mermaid sanity ${file}`, /^(flowchart|graph)\s+(LR|TD|RL|BT)\n/.test(text) && !text.includes('```'), 'expected bare Mermaid flowchart source')
}

const secretPatterns = [
  ['database URL', /(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?):\/\/[^\s`"']+/i],
  ['bearer token', /\bBearer\s+[A-Za-z0-9._~-]{16,}/],
  ['JWT', /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['cookie value', /\b(?:set-cookie|cookie)\s*:\s*[^\s;]{16,}/i],
  ['secret assignment', /\b(?:password|passwd|api[_-]?key|client[_-]?secret|session[_-]?token|smtp[_-]?(?:password|user))\b\s*[:=]\s*["']?(?!PRESENT\b|MISSING\b|CONFIGURED\b|UNKNOWN\b|none\b|disabled\b)[A-Za-z0-9+/_.~-]{16,}/i],
]
const scanFiles = filesUnder(outputDir).filter(file => !['.png','.jpg','.jpeg','.gif','.zip','.gz'].includes(extname(file)))
for (const [label, pattern] of secretPatterns) {
  const hits = scanFiles.filter(file => pattern.test(readFileSync(file, 'utf8'))).map(file => relative(outputDir, file))
  check(`secret scan ${label}`, hits.length === 0, hits.join(', '))
}

for (const result of checks) process.stdout.write(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.details && !result.ok ? ` — ${result.details}` : ''}\n`)
process.stdout.write(`API atlas verification: ${checks.length - failures.length}/${checks.length} checks passed.\n`)
if (failures.length) process.exitCode = 1
