import {execFileSync} from 'node:child_process'
import {existsSync, readFileSync, readdirSync, statSync} from 'node:fs'
import path from 'node:path'

import {
  collectDynamicHtmlTemplates,
  nginxRewriteForTemplate,
  resolveWebDistFile,
  selfTestResolveWebDistFile,
} from './resolve-web-dist-file.mjs'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const distDir = path.join(repoRoot, 'dist')
const expectedApiOrigin = process.env.EXPECTED_PUBLIC_API_ORIGIN ?? 'https://api.modula.digital'

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.mjs',
  '.svg',
  '.txt',
  '.webmanifest',
  '.xml',
])

function fail(message) {
  console.error(`verify_web_build_failed ${message}`)
  process.exit(1)
}

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function walk(dir) {
  const entries = []
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) entries.push(...walk(absolute))
    else entries.push(absolute)
  }
  return entries
}

if (!existsSync(distDir)) fail('dist directory does not exist')

const files = walk(distDir)
const relativeFiles = files.map(file => path.relative(distDir, file))
for (const required of ['index.html', 'version.json', 'release.json', 'checksums.sha256', '_expo/.routes.json']) {
  if (!relativeFiles.includes(required)) fail(`missing required artifact ${required}`)
}

const version = JSON.parse(readFileSync(path.join(distDir, 'version.json'), 'utf8'))
const head = git(['rev-parse', 'HEAD'])
if (version.commit !== head) fail(`version marker commit ${version.commit} does not match HEAD ${head}`)
if (version.environment !== 'production') fail(`version marker environment is ${version.environment}`)
if (version.dataSource !== 'remote') fail(`version marker data source is ${version.dataSource}`)
if (version.apiOrigin !== expectedApiOrigin) fail(`version marker api origin is ${version.apiOrigin}`)
if (!version.builtAt || Number.isNaN(Date.parse(version.builtAt))) fail('version marker builtAt is invalid')

const forbiddenFiles = relativeFiles.filter(file => {
  const basename = path.basename(file)
  return basename === '.env' || basename.startsWith('.env.') || file.endsWith('.map')
})
if (forbiddenFiles.length) fail(`forbidden files in artifact: ${forbiddenFiles.join(', ')}`)

if (relativeFiles.some(file => file === 'dev/components.html' || file.startsWith('dev/'))) {
  fail('development-only dev route emitted into production artifact')
}

const forbiddenPatterns = [
  [/Open WebUI/i, 'OpenWebUI signature'],
  [/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?/i, 'localhost API URL'],
  [/EXPO_PUBLIC_DEMO_SESSION\s*[:=]\s*["']?(?:owner|guest)/i, 'demo session bootstrap'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/, 'OpenAI-style secret key'],
  [/\b(?:DATABASE_URL|MODULA_DATABASE_URL|POSTGRES_PASSWORD|JWT_SECRET|EXPO_TOKEN)\s*[:=]/, 'server secret environment value'],
  [/\b(?:deterministic|mock)[-_ ]?ai[-_ ]?provider\b/i, 'development AI provider'],
]

let scannedBytes = 0
let hasExpectedApi = false
for (const file of files) {
  const extension = path.extname(file)
  if (!textExtensions.has(extension)) continue
  const relative = path.relative(distDir, file)
  const size = statSync(file).size
  scannedBytes += size
  const content = readFileSync(file, 'utf8')
  if (content.includes(expectedApiOrigin)) hasExpectedApi = true
  for (const [pattern, label] of forbiddenPatterns) {
    if (pattern.test(content)) fail(`${label} found in ${relative}`)
  }
}

if (!hasExpectedApi) fail(`expected production API origin ${expectedApiOrigin} was not embedded in artifact`)

const index = readFileSync(path.join(distDir, 'index.html'), 'utf8')
if (!index.includes('/_expo/static/')) fail('index.html does not reference Expo static assets')

const checksumManifest = readFileSync(path.join(distDir, 'checksums.sha256'), 'utf8')
for (const requiredChecksum of ['index.html', 'version.json', 'release.json']) {
  if (!checksumManifest.includes(`./${requiredChecksum}`)) {
    fail(`checksums.sha256 does not include ${requiredChecksum}`)
  }
}

selfTestResolveWebDistFile()

const routeProbes = [
  ['/', 'index.html'],
  ['/sign-in', 'sign-in.html'],
  ['/profile', 'profile/index.html'],
  ['/profile/edit', 'profile/edit.html'],
  ['/profile/phase7lb-hydration-probe', 'profile/[handle].html'],
  ['/profile/phase7lb-hydration-probe/followers', 'profile/[handle]/followers.html'],
  ['/module/digital.modula.vault-notes', 'module/[moduleId].html'],
  ['/module/digital.modula.vault-notes/notes/demo', 'module/[moduleId]/[...path].html'],
  ['/product/gaia', 'product/gaia.html'],
  ['/phase7m-b7-intentional-not-found', '+not-found.html'],
]
for (const [requestPath, expected] of routeProbes) {
  const resolved = resolveWebDistFile(distDir, requestPath)
  if (!resolved) fail(`web dist resolver missed ${requestPath}`)
  const relative = path.relative(distDir, resolved).split(path.sep).join('/')
  if (relative !== expected) fail(`web dist resolver mapped ${requestPath} to ${relative}, expected ${expected}`)
}

const nginxSnippet = readFileSync(
  path.join(repoRoot, 'ops/nginx/modula.digital-web.conf.snippet'),
  'utf8',
)
if (!nginxSnippet.includes('try_files $uri $uri.html $uri/index.html @expo_dynamic')) {
  fail('nginx snippet does not keep exact HTML lookup before Expo dynamic fallback')
}
if (!nginxSnippet.includes('location = /index') || !nginxSnippet.includes('return 308 /;')) {
  fail('nginx snippet does not redirect the legacy /index alias to canonical Home')
}
if (!nginxSnippet.includes('rewrite ^ /+not-found.html last;')) {
  fail('nginx snippet does not route unmatched paths to the exported not-found document')
}
for (const template of collectDynamicHtmlTemplates(distDir)) {
  const rewrite = nginxRewriteForTemplate(template)
  const line = `rewrite "${rewrite.regex}" "${rewrite.target}" last;`
  if (!nginxSnippet.includes(line)) {
    fail(`nginx snippet missing dynamic rewrite for ${template}`)
  }
}

console.log(JSON.stringify({
  status: 'ok',
  artifact: 'dist',
  files: files.length,
  scannedBytes,
  commit: head,
  apiOrigin: expectedApiOrigin,
}))
