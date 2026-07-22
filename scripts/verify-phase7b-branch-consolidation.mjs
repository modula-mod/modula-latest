#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const errors = []
const archivePrefix = 'refs/tags/archive/2026-07-21/'
const allowedHeads = new Set(['refs/heads/main', 'refs/heads/phase7b-greenfield-module-host'])

function sh(args) {
  return execFileSync(args[0], args.slice(1), {cwd: root, encoding: 'utf8'}).trim()
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel))
}

if (!exists('docs/audits/phase7b-branch-consolidation.md')) {
  errors.push('branch consolidation audit missing')
}

if (!exists('docs/security/phase7b-credential-rotation.md')) {
  errors.push('credential rotation audit missing')
}

const heads = sh(['git', 'ls-remote', '--heads', 'origin'])
  .split('\n')
  .map(line => line.trim().split(/\s+/)[1])
  .filter(Boolean)

const unexpected = heads.filter(head => !allowedHeads.has(head))
if (unexpected.length) errors.push(`unexpected remote branches: ${unexpected.join(', ')}`)

const tags = sh(['git', 'ls-remote', '--tags', 'origin', `${archivePrefix}*`])
  .split('\n')
  .filter(Boolean)
if (tags.length < 1) errors.push('archive tags for deleted branch tips are missing')

const current = sh(['git', 'rev-parse', '--abbrev-ref', 'HEAD'])
if (current !== 'phase7b-greenfield-module-host' && current !== 'main') {
  errors.push(`unexpected active branch ${current}`)
}

const mainSha = sh(['git', 'rev-parse', 'origin/main'])
if (!mainSha) errors.push('origin/main could not be resolved')

if (errors.length) {
  console.error('Phase 7B branch consolidation verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7B branch consolidation verification passed.')
