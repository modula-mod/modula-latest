#!/usr/bin/env node
import {spawnSync} from 'node:child_process'
import {existsSync} from 'node:fs'
import {resolve} from 'node:path'

const hostRoot = process.cwd()
const mpsRoot = resolve(process.env.MODULA_PRODUCT_STANDARD_ROOT ?? '/root/modula-mod/modula-product-standard')
const generatorRoot = resolve(process.env.MODULA_PRODUCT_GENERATOR_ROOT ?? '/root/modula-platform/modula-product-templates')
const failures = []

console.log('MODULA')
console.log('PLATFORM FOUNDATION V1')
console.log('CANONICAL VERIFIER\n')

record('CI MODE', process.env.CI === 'true', `CI=${process.env.CI ?? 'unset'}`)
record('MPS CHECKOUT', existsSync(resolve(mpsRoot, 'package.json')), mpsRoot)
record('GENERATOR CHECKOUT', existsSync(resolve(generatorRoot, 'package.json')), generatorRoot)

if (failures.length === 0) {
  run('MPS', 'pnpm', ['verify:mps'], mpsRoot, {...process.env, CI: 'true'})
  run('GENERATOR', 'pnpm', ['verify'], generatorRoot, {
    ...process.env,
    CI: 'true',
    MODULA_PRODUCT_STANDARD_ROOT: mpsRoot,
  })
  run('GREENFIELD × MPS', 'pnpm', ['verify:greenfield-mps-v1'], hostRoot, {...process.env, CI: 'true'})
  run('PRODUCT FRONTEND + NEUTRAL MODULE', 'pnpm', ['verify:product-frontend-v1'], hostRoot, {
    ...process.env,
    CI: 'true',
    MODULA_HOST_ROOT: hostRoot,
  })
  run('VAULT PRODUCT RELEASES', 'pnpm', ['verify:vault-products'], hostRoot, {...process.env, CI: 'true'})
  run('FINAL GIT DIFF CHECK', 'git', ['diff', '--check'], hostRoot, process.env)
}

console.log('\nRESULT')
if (failures.length) {
  console.log(`CI=true pnpm verify:platform-foundation-v1\nFAIL (${failures.length})`)
  for (const failure of failures) console.log(`- ${failure}`)
  process.exit(1)
}

console.log('MPS'.padEnd(52) + ' PASS')
console.log('GREENFIELD × MPS'.padEnd(52) + ' PASS')
console.log('PRODUCT FRONTEND'.padEnd(52) + ' PASS')
console.log('GENERATOR'.padEnd(52) + ' PASS')
console.log('NEUTRAL PRODUCT'.padEnd(52) + ' PASS')
console.log('VAULT PRODUCTS'.padEnd(52) + ' PASS')
console.log('CI=true pnpm verify:platform-foundation-v1\nPASS')

function run(label, command, args, cwd, env) {
  console.log(`\n$ ${command} ${args.join(' ')}  # ${label}`)
  const result = spawnSync(command, args, {cwd, env, stdio: 'inherit', shell: false})
  record(label, result.status === 0, result.status === 0 ? 'completed' : `exit ${String(result.status)}`)
}

function record(label, passed, detail = '') {
  console.log(`${label.padEnd(52)} ${passed ? 'PASS' : 'FAIL'}${detail ? `  ${detail}` : ''}`)
  if (!passed) failures.push(`${label}: ${detail || 'failed'}`)
}
