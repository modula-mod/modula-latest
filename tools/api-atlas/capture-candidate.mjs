#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import {mkdirSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {
  apiSourceFingerprint,
  captureLocalRuntimeRoutes,
  command,
  evidenceDir,
  json,
  repoRoot,
  sanitizeForSecretScan,
} from './lib.mjs'

execFileSync('pnpm', ['--filter', '@modula/greenfield-api...', 'build'], {cwd: repoRoot, stdio: 'inherit'})

const branch = process.env.API_ATLAS_CANDIDATE_BRANCH || process.env.GITHUB_HEAD_REF || command('git', ['branch', '--show-current'])
if (!branch || branch === 'main') throw new Error('Candidate runtime capture requires a named non-main feature branch')
const sourceFingerprint = apiSourceFingerprint()
const runtimeRoutes = captureLocalRuntimeRoutes()
if (apiSourceFingerprint() !== sourceFingerprint) {
  throw new Error('API source changed during candidate runtime capture; retry after concurrent edits finish')
}

const evidence = {
  schemaVersion: 1,
  evidenceKind: 'local-candidate-runtime',
  capturedAt: new Date().toISOString(),
  source: {
    branch,
    headAtCapture: command('git', ['rev-parse', 'HEAD']),
    worktreeDirtyAtCapture: Boolean(command('git', ['status', '--short', '--', 'services/greenfield-api/src'])),
    apiSourceSha256: sourceFingerprint,
  },
  runtimeRoutes,
}

mkdirSync(evidenceDir, {recursive: true})
writeFileSync(join(evidenceDir, 'candidate-runtime.json'), sanitizeForSecretScan(json(evidence)))
process.stdout.write(`Captured local candidate runtime for ${branch}: ${evidence.runtimeRoutes.length} method routes\n`)
