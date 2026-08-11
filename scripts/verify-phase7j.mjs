#!/usr/bin/env node
/**
 * Phase 7J aggregate verifier — orchestrates automatable gates.
 * Full product DoD still requires Simulator + VPS evidence.
 */
import {spawnSync} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import path from 'node:path'

const root = process.cwd()

function run(label, command, args) {
  console.log(`\n==> ${label}`)
  const result = spawnSync(command, args, {stdio: 'inherit', cwd: root, shell: false})
  if (result.status !== 0) {
    console.error(`FAIL: ${label} (exit ${result.status ?? 'null'})`)
    process.exit(result.status ?? 1)
  }
  console.log(`PASS: ${label}`)
}

function assertFile(rel, needle) {
  const full = path.join(root, rel)
  if (!existsSync(full)) {
    console.error(`FAIL: missing ${rel}`)
    process.exit(1)
  }
  if (needle) {
    const text = readFileSync(full, 'utf8')
    if (!text.includes(needle)) {
      console.error(`FAIL: ${rel} missing expected content: ${needle}`)
      process.exit(1)
    }
  }
  console.log(`PASS: ${rel}`)
}

console.log('Phase 7J verify aggregator')

assertFile('docs/engineering/phase7j-branch-inventory.md', 'phase7j-product-convergence')
assertFile('docs/engineering/phase7j-branch-convergence.md', 'MERGE_FULL')
assertFile('docs/validation/phase7j-mainline-consolidation.md', 'Mission C')
assertFile('docs/engineering/phase7j-mac-drift-classification.md', 'REQUIRED_PRODUCT')
assertFile('docs/research/phase7j-design-skills.md', 'modula-ui')
assertFile('docs/research/phase7j-native-runtime-baseline.md', 'expo')
assertFile('docs/research/phase7j-component-admission-matrix.md', 'Surface')
assertFile('docs/validation/phase7j-feature-matrix.md', 'SESSION_RESTORE')
assertFile('docs/validation/phase7i-mac-b-final.md', 'SESSION_RESTORE = PASS')
assertFile('src/auth/runtime/SessionProvider.tsx', 'refreshSession')
assertFile('src/theme/contracts/materials.ts', 'springs')
assertFile('src/data/repositories/api/ApiPostRepository.ts', 'updatePost')

run('lint', 'pnpm', ['lint'])
run('typecheck', 'pnpm', ['typecheck'])

console.log('\nPhase 7J automated gates PASS')
console.log('Remaining: PR CI green, optional Simulator golden paths, VPS deploy parity.')
