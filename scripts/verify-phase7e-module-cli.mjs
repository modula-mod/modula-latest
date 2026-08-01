#!/usr/bin/env node
import {mkdtemp, rm} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join, resolve} from 'node:path'
import {spawnSync} from 'node:child_process'

const root = process.cwd()
const standardRoot = resolve(root, '../modula-mod/modula-module-standard')
const failures = []

function pass(message) {
  console.log(`PASS ${message}`)
}

function fail(message) {
  failures.push(message)
  console.error(`FAIL ${message}`)
}

function run(command, args, label, cwd = root, expectStatus = 0) {
  const result = spawnSync(command, args, {cwd, env: process.env, stdio: 'inherit', shell: false})
  if (result.status === expectStatus) pass(label)
  else fail(`${label} exited ${result.status ?? 'without status'}, expected ${expectStatus}`)
}

run('pnpm', ['build'], 'external module CLI package builds', standardRoot)
run('pnpm', ['--filter', '@modula/modula-cli', 'build'], 'app modula CLI builds')
run('pnpm', ['modula', '--', 'module', 'validate', 'templates/modula-module/modula.module.json'], 'app CLI validates Standard 1.0 template')
run('pnpm', ['modula', '--', 'module', 'inspect', 'templates/modula-module/modula.module.json'], 'app CLI inspects Standard 1.0 template')
run('pnpm', ['modula', '--', 'module', 'test', 'templates/modula-module/modula.module.json'], 'app CLI runs module sandbox test')
run('pnpm', ['modula', '--', 'module', 'publish', 'templates/modula-module/modula.module.json'], 'app CLI publish runs validation-only preflight')
run('pnpm', ['modula', '--', 'module', 'doctor', 'templates/modula-module/modula.module.json'], 'app CLI runs module doctor')
run('pnpm', ['modula', '--', 'module', 'schema', 'templates/modula-module/modula.module.json'], 'app CLI prints manifest schema metadata')
run('pnpm', ['modula', '--', 'module', 'docs', 'templates/modula-module/modula.module.json'], 'app CLI prints generated docs summary')
run('pnpm', ['modula', '--', 'module', 'bundle', 'templates/modula-module/modula.module.json'], 'app CLI runs bundle preflight')
run('pnpm', ['modula', '--', 'module', 'release', 'templates/modula-module/modula.module.json'], 'app CLI runs release preflight')

const tempDir = await mkdtemp(join(tmpdir(), 'modula-module-cli-'))
try {
  run('pnpm', ['modula', '--', 'module', 'create', tempDir, '--id', 'com.example.cli-module', '--name', 'CLI Module'], 'app CLI creates module template')
  run('pnpm', ['modula', '--', 'module', 'validate', join(tempDir, 'manifest.json')], 'generated CLI template validates')
  run('pnpm', ['modula', '--', 'module', 'doctor', join(tempDir, 'manifest.json')], 'generated CLI template passes doctor')
} finally {
  await rm(tempDir, {recursive: true, force: true})
}

if (failures.length > 0) {
  console.error(`Phase 7E module CLI verifier failed: ${failures.length} issue(s)`)
  process.exit(1)
}

console.log('Phase 7E module CLI verifier passed')
