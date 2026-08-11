#!/usr/bin/env node
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'

const root = process.cwd()
const oldHomeRoot = ['/home', 'andrei'].join('/')
const forbiddenPaths = [
  oldHomeRoot,
  [oldHomeRoot, 'modula-latest'].join('/'),
  [oldHomeRoot, 'modula-mod'].join('/'),
]

const scanTargets = [
  'services',
  'scripts',
  'packages',
  'src',
  'fixtures',
  'ops',
  'package.json',
  'pnpm-workspace.yaml',
  'pnpm-lock.yaml',
]

const ignoredDirectories = new Set([
  '.git',
  '.expo',
  'node_modules',
  'dist',
  'build',
  'coverage',
])

const errors = []
let filesScanned = 0

for (const target of scanTargets) {
  const absolute = join(root, target)
  if (!existsSync(absolute)) {
    errors.push(`missing scan target ${target}`)
    continue
  }
  scan(absolute)
}

function scan(path) {
  const stat = statSync(path)
  if (stat.isDirectory()) {
    if (ignoredDirectories.has(path.split('/').at(-1))) return
    for (const entry of readdirSync(path)) scan(join(path, entry))
    return
  }
  if (!stat.isFile()) return
  filesScanned += 1
  const text = readFileSync(path, 'utf8')
  for (const forbidden of forbiddenPaths) {
    if (text.includes(forbidden)) {
      errors.push(`${relative(root, path)} references forbidden legacy source path ${forbidden}`)
    }
  }
}

if (errors.length) {
  console.error('Phase 7I canonical source verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log(`Phase 7I canonical source verification passed (${filesScanned} files scanned).`)
