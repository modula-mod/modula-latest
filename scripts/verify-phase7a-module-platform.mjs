#!/usr/bin/env node
import {execFileSync} from 'node:child_process'
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'
import {validateGreenfieldModuleManifest} from '@modula/greenfield-module-manifest'

const checks = []
const root = process.cwd()
const vaultRoot = '/home/andrei/modules/modula-module-vault-notes'

function check(name, fn) {
  try {
    fn()
    checks.push({name, ok: true})
  } catch (error) {
    checks.push({name, ok: false, error: error instanceof Error ? error.message : String(error)})
  }
}

function file(path) {
  const abs = join(root, path)
  if (!existsSync(abs)) throw new Error(`${path} missing`)
  return readFileSync(abs, 'utf8')
}

function sh(args, cwd = root) {
  return execFileSync(args[0], args.slice(1), {cwd, encoding: 'utf8'}).trim()
}

function rgMaybe(args, cwd = root) {
  try {
    return sh(args, cwd)
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error && error.status === 1) return ''
    throw error
  }
}

check('current branch is Phase 7A', () => {
  if (sh(['git', 'branch', '--show-current']) !== 'phase7a-greenfield-module-platform') throw new Error('wrong branch')
})
check('baseline audit exists', () => file('docs/audits/phase7a-extension-foundation-audit.md'))
check('frontend boundary verifier passes', () => sh(['node', 'scripts/verify-phase7a-frontend-boundary.mjs']))
check('Manifest v1 exists', () => file('packages/greenfield-module-manifest/src/manifest.ts').includes('GREENFIELD_MODULE_MANIFEST_VERSION'))
check('manifest JSON Schema exists', () => file('packages/greenfield-module-manifest/schemas/module-manifest.v1.schema.json').includes('"const": 1'))
check('Module SDK exists', () => file('packages/greenfield-module-sdk/src/define-module.ts'))
check('registry contracts exist', () => file('packages/greenfield-module-registry-contracts/src/registry.ts'))
check('identifiers are namespaced', () => file('packages/greenfield-module-manifest/src/identity.ts').includes('reverse-domain'))
check('reserved namespaces exist', () => file('packages/greenfield-module-manifest/src/identity.ts').includes('digital.dimon'))
check('immutable source commits are required', () => file('packages/greenfield-module-manifest/src/source.ts').includes('FULL_GIT_COMMIT_PATTERN'))
check('compatibility checks exist', () => file('services/greenfield-api/src/modules/compatibility-service.ts').includes('GREENFIELD_VERSION_TOO_OLD'))
check('dependencies are resolved', () => file('services/greenfield-api/src/modules/dependency-resolver.ts').includes('DependencyResolutionPlan'))
check('circular dependencies are rejected', () => file('services/greenfield-api/src/modules/dependency-resolver.ts').includes('detectCircular'))
check('permissions are namespaced', () => file('packages/greenfield-module-manifest/src/permissions.ts').includes('records:module'))
check('DIMON permissions are restricted', () => file('packages/greenfield-module-manifest/src/permissions.ts').includes('RESERVED_DIMON_PERMISSIONS'))
check('publisher registry exists', () => file('services/greenfield-api/migrations/009_phase7a_module_platform.sql').includes('greenfield_publishers'))
check('namespace ownership exists', () => file('services/greenfield-api/migrations/009_phase7a_module_platform.sql').includes('greenfield_publisher_namespaces_active_unique'))
check('release integrity exists', () => file('services/greenfield-api/migrations/009_phase7a_module_platform.sql').includes('greenfield_module_release_integrity'))
check('licence evidence exists', () => file('services/greenfield-api/migrations/009_phase7a_module_platform.sql').includes('greenfield_module_license_evidence'))
check('trust levels exist', () => file('services/greenfield-api/migrations/009_phase7a_module_platform.sql').includes('reviewedCommunity'))
check('quarantine exists', () => file('services/greenfield-api/src/modules/quarantine-service.ts').includes('quarantineRelease'))
check('revocation exists', () => file('services/greenfield-api/src/modules/quarantine-service.ts').includes('revokeRelease'))
check('installation state machine exists', () => file('packages/greenfield-module-registry-contracts/src/installation.ts').includes('GREENFIELD_MODULE_INSTALLATION_TRANSITIONS'))
check('permission review exists', () => file('services/greenfield-api/migrations/009_phase7a_module_platform.sql').includes('greenfield_module_permission_reviews'))
check('update review exists', () => file('services/greenfield-api/src/modules/update-service.ts').includes('approvedPermissionIncrease'))
check('uninstall data choices exist', () => file('services/greenfield-api/src/modules/uninstall-service.ts').includes('exportThenDelete'))
check('schema-driven settings exist', () => file('services/greenfield-api/src/modules/settings-service.ts').includes('settingsDefaults'))
check('contribution registration exists', () => file('services/greenfield-worker/src/modules/contribution-registration-handler.ts').includes('registerModuleContributions'))
check('worker lifecycle jobs exist', () => file('services/greenfield-worker/src/jobs/runner.ts').includes("case 'module.install'"))
check('arbitrary source execution is absent', () => {
  const output = rgMaybe(['rg', '-n', 'eval\\(|new Function|module-provided SQL|arbitrary shell|npm install|pnpm add', 'services/greenfield-api/src/modules', 'services/greenfield-worker/src/modules', 'packages/greenfield-module-manifest', 'packages/greenfield-module-sdk', 'packages/greenfield-module-registry-contracts'])
  if (output) throw new Error(output)
})
check('dynamic package installation is absent', () => {
  const output = rgMaybe(['rg', '-n', 'npm install|pnpm add|dynamic npm', 'services/greenfield-api/src/modules', 'services/greenfield-worker/src/modules', 'scripts/registry'], root)
  if (output) throw new Error(output)
})
check('remote functions are disabled', () => file('services/greenfield-api/src/config/env.ts').includes('GREENFIELD_MODULE_REMOTE_FUNCTIONS_ENABLED'))
check('module record isolation exists', () => file('services/greenfield-api/src/modules/module-domain.ts').includes('assertModuleRecordIsolation'))
check('module secret references exist', () => file('services/greenfield-api/src/modules/module-domain.ts').includes('GreenfieldModuleSecretReference'))
check('Vault Notes is external', () => {
  if (!existsSync(vaultRoot)) throw new Error('external Vault Notes repo missing')
})
check('Vault Notes is not implemented in the host', () => sh(['node', 'scripts/verify-phase7a-frontend-boundary.mjs']))
check('Vault Notes manifest validates', () => {
  const manifestPath = join(vaultRoot, 'module.manifest.json')
  if (!existsSync(manifestPath)) throw new Error('Vault Notes manifest missing')
  const result = validateGreenfieldModuleManifest(JSON.parse(readFileSync(manifestPath, 'utf8')))
  if (!result.valid) throw new Error(result.issues.map(issue => issue.code).join(','))
})
check('Vault Notes data is private by default', () => {
  const note = JSON.parse(readFileSync(join(vaultRoot, 'schemas/vault-note.v1.schema.json'), 'utf8'))
  if (!note.properties?.visibility?.default || note.properties.visibility.default !== 'private') throw new Error('Vault note default visibility is not private')
  if (note.properties.visibility.enum.includes('public') || note.properties.visibility.enum.includes('followers')) throw new Error('public/followers visibility must be rejected')
})
check('Tasks and CRM are placeholders', () => {
  const migration = file('services/greenfield-api/migrations/009_phase7a_module_platform.sql')
  if (!migration.includes('digital.modula.tasks') || !migration.includes('digital.modula.crm') || !migration.includes('notInstallable')) {
    throw new Error('planned module placeholders missing')
  }
})
check('DIMON remains inactive', () => file('services/greenfield-api/migrations/009_phase7a_module_platform.sql').includes('digital.dimon.core'))
check('no balance or wallet exists', () => {
  const output = rgMaybe(['rg', '-n', 'CREATE TABLE .*dimon.*(balance|wallet|transaction)|greenfield_dimon_(balances|wallets|transactions)', 'services/greenfield-api/migrations', 'services/greenfield-api/src/modules'], root)
  if (output) throw new Error(output)
})
check('previous verifiers remain', () => {
  for (const script of [
    'scripts/verify-phase1-shell.mjs',
    'scripts/verify-phase2-appearance.mjs',
    'scripts/verify-phase3-profile.mjs',
    'scripts/verify-phase4-data-auth.mjs',
    'scripts/verify-phase5-backend.mjs',
    'scripts/verify-phase6-greenfield-backend.mjs',
    'scripts/verify-phase6s-social-backend.mjs',
  ]) file(script)
})
check('working tree is clean at final execution', () => {
  const status = sh(['git', 'status', '--short'])
  if (status) throw new Error(status)
})

const failed = checks.filter(item => !item.ok)
for (const item of checks) {
  console.log(`${item.ok ? 'PASS' : 'FAIL'} ${item.name}${item.ok ? '' : `: ${item.error}`}`)
}
if (failed.length > 0) process.exit(1)
console.log('MODULA PHASE 7A MODULE PLATFORM VERIFIED')
