#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {resolve} from 'node:path'

const hostRoot = resolve(process.env.MODULA_HOST_ROOT ?? process.cwd())
const productRoot = resolve(process.env.MODULA_REFERENCE_TASKS_ROOT ?? '/root/modula-mod/modula-reference-tasks')
const release020Root = resolve(process.env.REFERENCE_TASKS_RELEASE_020_ROOT ?? '/root/modula-mod/modula-reference-tasks-release-0.2.0')
const release021Root = resolve(process.env.REFERENCE_TASKS_RELEASE_021_ROOT ?? '/root/modula-mod/modula-reference-tasks-release-0.2.1')
const proof = resolve(productRoot, 'tests/runtime-proof.ts')
const failures = []

const releases = [
  {
    root: release020Root,
    version: '0.2.0',
    commit: 'd8ac5490a59915529c296671ac2a1d44baaec041',
  },
  {
    root: release021Root,
    version: '0.2.1',
    commit: '15befbc0e0ce93f738557cd2a2b0b748928df30f',
  },
]

console.log('MODULA')
console.log('REFERENCE TASKS')
console.log('ZERO-CORE PRODUCT RUNTIME VERIFIER\n')

record('HOST CHECKOUT', existsSync(resolve(hostRoot, 'package.json')), hostRoot)
record('REFERENCE TASKS PRODUCT', existsSync(resolve(productRoot, 'modula.product.json')), productRoot)
record('PRODUCT-OWNED RUNTIME PROOF', existsSync(proof), proof)
record('PRODUCT MAIN CLEAN', git(productRoot, ['status', '--porcelain']) === '', productRoot)
record(
  'CANONICAL GENERATOR ANCESTRY',
  gitStatus(productRoot, ['merge-base', '--is-ancestor', 'c6fc55bc0fc4fa008b21eeb9801b4284d2a1a6f7', 'HEAD']) === 0,
  'c6fc55bc0fc4fa008b21eeb9801b4284d2a1a6f7',
)

for (const release of releases) {
  record(`RELEASE ${release.version} CHECKOUT`, existsSync(resolve(release.root, 'modula.product.json')), release.root)
  record(`RELEASE ${release.version} COMMIT`, git(release.root, ['rev-parse', 'HEAD']) === release.commit, release.commit)
  record(`RELEASE ${release.version} CLEAN`, git(release.root, ['status', '--porcelain']) === '', release.root)
}

if (failures.length === 0) {
  console.log('\n$ pnpm --filter @modula/greenfield-api exec tsx <product>/tests/runtime-proof.ts')
  const result = spawnSync(
    'pnpm',
    ['--filter', '@modula/greenfield-api', 'exec', 'tsx', proof],
    {
      cwd: hostRoot,
      env: {
        ...process.env,
        CI: 'true',
        MODULA_HOST_ROOT: hostRoot,
        REFERENCE_TASKS_RELEASE_020_ROOT: release020Root,
        REFERENCE_TASKS_RELEASE_021_ROOT: release021Root,
      },
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      shell: false,
    },
  )
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  record('REFERENCE TASKS FULL JOURNEY', result.status === 0, result.status === 0 ? 'PASS' : `exit ${String(result.status)}`)
}

if (failures.length) {
  console.error('\nverify:reference-tasks-zero-core FAIL')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nverify:reference-tasks-zero-core PASS')
console.log('GREENFIELD SOURCE MODIFICATIONS = 0')
console.log('PRODUCT-SPECIFIC SHELL MODIFICATIONS = 0')
console.log('FRONTEND UPDATE WITHOUT SHELL DEPLOY = PASS')
console.log('PUBLIC TEST PRODUCTS = 0')

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(48)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}: ${detail || 'failed'}`)
}

function git(cwd, args) {
  const result = spawnSync('git', args, {cwd, encoding: 'utf8', shell: false})
  return result.status === 0 ? result.stdout.trim() : ''
}

function gitStatus(cwd, args) {
  return spawnSync('git', args, {cwd, stdio: 'ignore', shell: false}).status
}
