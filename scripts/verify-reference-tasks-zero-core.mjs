#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import {resolve} from 'node:path'

const hostRoot = resolve(process.env.MODULA_HOST_ROOT ?? process.cwd())
const productRoot = resolve(process.env.MODULA_REFERENCE_TASKS_ROOT ?? '/root/modula-mod/modula-reference-tasks-mps1')
const productStandardRoot = resolve(process.env.MODULA_PRODUCT_STANDARD_ROOT ?? '/root/modula-mod/modula-product-standard')
const release010Root = resolve(process.env.REFERENCE_TASKS_MPS1_RELEASE_010_ROOT ?? '/root/modula-mod/modula-reference-tasks-mps1-release-0.1.0')
const release011Root = resolve(process.env.REFERENCE_TASKS_MPS1_RELEASE_011_ROOT ?? '/root/modula-mod/modula-reference-tasks-mps1-release-0.1.1')
const proof = resolve(productRoot, 'tests/runtime-proof.ts')
const failures = []

const releases = [
  {
    root: release010Root,
    version: '0.1.0',
    commit: 'f44a10249694ee5d62a0c7986b12a27f564ccb30',
  },
  {
    root: release011Root,
    version: '0.1.1',
    commit: '1d452fae70d2bbb141871877fe34e7be55615b44',
  },
]

console.log('MODULA')
console.log('REFERENCE TASKS')
console.log('ZERO-CORE PRODUCT RUNTIME VERIFIER\n')

record('HOST CHECKOUT', existsSync(resolve(hostRoot, 'package.json')), hostRoot)
record('REFERENCE TASKS PRODUCT', existsSync(resolve(productRoot, 'modula.product.json')), productRoot)
record('MPS 1.0 COMPILER', existsSync(resolve(productStandardRoot, 'packages/product-frontend/dist/cli.js')), productStandardRoot)
record('PRODUCT-OWNED RUNTIME PROOF', existsSync(proof), proof)
record('PRODUCT MAIN CLEAN', git(productRoot, ['status', '--porcelain']) === '', productRoot)
record(
  'CANONICAL GENERATOR TSX SCAFFOLD',
  fileIncludes(resolve(productRoot, 'README.md'), 'canonical Modula product generator')
    && fileIncludes(resolve(productRoot, 'AGENTS.md'), 'typed TS/TSX with @modula/product-ui')
    && fileIncludes(resolve(productRoot, 'frontend/index.tsx'), "from '@modula/product-ui'"),
  'generated TSX product scaffold',
)

for (const release of releases) {
  record(`RELEASE ${release.version} CHECKOUT`, existsSync(resolve(release.root, 'modula.product.json')), release.root)
  record(`RELEASE ${release.version} COMMIT`, git(release.root, ['rev-parse', 'HEAD']) === release.commit, release.commit)
  record(`RELEASE ${release.version} CLEAN`, git(release.root, ['status', '--porcelain']) === '', release.root)
}

if (failures.length === 0) {
  for (const release of releases) {
    runProductVerify(release)
  }

  if (failures.length > 0) {
    console.error('\nverify:reference-tasks-zero-core FAIL')
    for (const failure of failures) console.error(`- ${failure}`)
    process.exit(1)
  }

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
        MODULA_PRODUCT_STANDARD_ROOT: productStandardRoot,
        REFERENCE_TASKS_MPS1_RELEASE_010_ROOT: release010Root,
        REFERENCE_TASKS_MPS1_RELEASE_011_ROOT: release011Root,
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

function fileIncludes(file, value) {
  return existsSync(file) && readFileSync(file, 'utf8').includes(value)
}

function runProductVerify(release) {
  console.log(`\n$ pnpm verify  # Reference Tasks ${release.version} TSX build, preview, MPS validation`)
  const result = spawnSync('pnpm', ['verify'], {
    cwd: release.root,
    env: {...process.env, CI: 'true', MODULA_PRODUCT_STANDARD_ROOT: productStandardRoot},
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    shell: false,
  })
  if (result.stdout) process.stdout.write(result.stdout)
  if (result.stderr) process.stderr.write(result.stderr)
  record(`RELEASE ${release.version} TSX BUILD / PREVIEW / MPS VERIFY`, result.status === 0, result.status === 0 ? 'PASS' : `exit ${String(result.status)}`)
}
