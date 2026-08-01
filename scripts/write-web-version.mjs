import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(new URL('..', import.meta.url).pathname)
const distDir = path.join(repoRoot, 'dist')
const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'package.json'), 'utf8'))

function git(args) {
  return execFileSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? ''
const apiOrigin = apiUrl ? new URL(apiUrl).origin : null
const version = {
  app: 'modula',
  version: packageJson.version,
  phase: 'phase7e-block14',
  commit: git(['rev-parse', 'HEAD']),
  branch: git(['branch', '--show-current']),
  builtAt: new Date().toISOString(),
  environment: process.env.EXPO_PUBLIC_APP_ENV ?? null,
  dataSource: process.env.EXPO_PUBLIC_DATA_SOURCE ?? null,
  apiOrigin,
}

mkdirSync(distDir, {recursive: true})
writeFileSync(path.join(distDir, 'version.json'), `${JSON.stringify(version, null, 2)}\n`)
writeFileSync(path.join(distDir, 'release.json'), `${JSON.stringify(version, null, 2)}\n`)

function walk(dir) {
  const entries = []
  for (const entry of readdirSync(dir, {withFileTypes: true})) {
    const absolute = path.join(dir, entry.name)
    if (entry.isDirectory()) entries.push(...walk(absolute))
    else entries.push(absolute)
  }
  return entries
}

const checksumLines = walk(distDir)
  .filter(file => path.basename(file) !== 'checksums.sha256')
  .sort()
  .map(file => {
    const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
    return `${hash}  ./${path.relative(distDir, file)}`
  })

writeFileSync(path.join(distDir, 'checksums.sha256'), `${checksumLines.join('\n')}\n`)

console.log(`web_version_marker_ok ${version.commit} files=${checksumLines.length}`)
