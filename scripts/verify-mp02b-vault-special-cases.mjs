import {readFile, readdir, stat} from 'node:fs/promises'
import {resolve, relative, sep} from 'node:path'
import process from 'node:process'

const root = process.cwd()
const inventoryPath = resolve(root, 'docs/audits/module-platform-02b/vault-special-cases.json')
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'))
const allowed = new Map(inventory.allowedCompatibility.map(item => [item.path, item]))
const extensions = new Set(['.ts', '.tsx'])
const sourceRoots = ['packages', 'services', 'src']
const excludedSegments = new Set(['node_modules', 'dist', 'tests', 'test', 'fixtures', 'migrations', 'scripts', 'demo', 'dev', 'local'])
const exactToken = inventory.token
const failures = []
const observed = new Map()

for (const sourceRoot of sourceRoots) {
  for (const path of await files(resolve(root, sourceRoot))) {
    const projectPath = relative(root, path).split(sep).join('/')
    if (!extensions.has(extension(projectPath)) || excluded(projectPath)) continue
    const source = await readFile(path, 'utf8')
    const occurrences = source.split(exactToken).length - 1
    if (occurrences > 0) observed.set(projectPath, occurrences)
  }
}

for (const [path, count] of observed) {
  const entry = allowed.get(path)
  if (!entry) failures.push(`${path}: unlisted ${exactToken} runtime reference (${count})`)
  else if (count > entry.maximumOccurrences) failures.push(`${path}: ${count} references exceeds compatibility cap ${entry.maximumOccurrences}`)
}
for (const entry of allowed.values()) {
  const count = observed.get(entry.path) ?? 0
  if (count > entry.maximumOccurrences) failures.push(`${entry.path}: compatibility cap exceeded`)
  if (!entry.reason || !entry.removalCondition) failures.push(`${entry.path}: compatibility entry lacks reason/removal condition`)
}

const genericPaths = [
  'packages/greenfield-module-sdk/src',
  'packages/greenfield-module-ui-contracts/src',
  'services/greenfield-api/src/domains/search',
  'services/greenfield-api/src/intelligence/action-boundary.ts',
  'services/greenfield-worker/src/search',
  'src/features/modules/runtime',
]
for (const genericPath of genericPaths) {
  const absolute = resolve(root, genericPath)
  const info = await stat(absolute)
  const paths = info.isDirectory() ? await files(absolute) : [absolute]
  for (const path of paths) {
    const source = await readFile(path, 'utf8')
    if (/vault[- ]notes/i.test(source)) failures.push(`${relative(root, path)}: generic runtime path contains a Vault-specific branch/reference`)
  }
}

if (failures.length > 0) {
  console.error('MP02B Vault special-case gate: FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exitCode = 1
} else {
  const count = [...observed.values()].reduce((total, value) => total + value, 0)
  console.log(`MP02B Vault special-case gate: PASS (${observed.size} bounded files, ${count} canonical-ID occurrences, 0 generic runtime branches)`)
}

async function files(path) {
  const info = await stat(path)
  if (info.isFile()) return [path]
  const result = []
  for (const entry of await readdir(path, {withFileTypes: true})) {
    if (entry.isSymbolicLink()) continue
    result.push(...await files(resolve(path, entry.name)))
  }
  return result
}

function extension(path) {
  return path.endsWith('.tsx') ? '.tsx' : path.endsWith('.ts') ? '.ts' : ''
}

function excluded(path) {
  return path.split('/').some(segment => excludedSegments.has(segment))
}
