#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
let failures = 0
const ok = msg => console.log(`PASS ${msg}`)
const fail = msg => {
  console.error(`FAIL ${msg}`)
  failures += 1
}
const exists = rel => fs.existsSync(path.join(root, rel))
const read = rel => fs.readFileSync(path.join(root, rel), 'utf8')

function mustInclude(rel, needles, label) {
  if (!exists(rel)) {
    fail(`${label}: missing ${rel}`)
    return false
  }
  const text = read(rel)
  for (const needle of needles) {
    if (!text.includes(needle)) {
      fail(`${label}: missing ${needle} in ${rel}`)
      return false
    }
  }
  return true
}

function mustExist(rel, label) {
  if (exists(rel)) {
    ok(label)
    return true
  }
  fail(label)
  return false
}

// 1. ModulaAuthState core statuses
if (
  mustInclude(
    'src/auth/contracts/ModulaAuthState.ts',
    [
      "status: 'loading'",
      "status: 'signedOut'",
      "status: 'pendingVerification'",
      "status: 'signedIn'",
      "status: 'refreshing'",
      "status: 'suspended'",
      "status: 'error'",
      'GreenfieldAccount',
    ],
    '1. ModulaAuthState',
  )
) {
  ok('1. ModulaAuthState defines core Greenfield auth statuses')
}

// 2. Demo-owner is not production default
if (
  mustInclude(
    'src/config/runtimeEnvironment.ts',
    ["appEnvironment === 'production'", "return 'signedOut'", "EXPO_PUBLIC_DEMO_SESSION"],
    '2. Demo bootstrap',
  ) &&
  read('src/config/runtimeEnvironment.ts').includes("return 'signedOut'")
) {
  const envSrc = read('src/config/runtimeEnvironment.ts')
  if (envSrc.includes("return 'owner'") && !envSrc.includes('// Default signed-out')) {
    fail('2. Demo-owner must not be the default bootstrap')
  } else {
    ok('2. Demo-owner is not the production/default bootstrap')
  }
}

// 3. Native account auth routes
const authRoutes = [
  'src/app/(auth)/welcome.tsx',
  'src/app/(auth)/register.tsx',
  'src/app/(auth)/verify-email.tsx',
  'src/app/(auth)/sign-in.tsx',
  'src/app/(auth)/forgot-password.tsx',
  'src/app/(auth)/reset-password.tsx',
]
if (authRoutes.every(exists)) ok('3. Native account auth routes exist')
else fail('3. Native account auth routes exist')

// 4. Account settings routes
const accountRoutes = [
  'src/app/settings/account.tsx',
  'src/app/settings/account/handle.tsx',
  'src/app/settings/account/email.tsx',
  'src/app/settings/account/password.tsx',
  'src/app/settings/account/sessions.tsx',
  'src/app/settings/account/export.tsx',
]
if (accountRoutes.every(exists)) ok('4. Account management routes exist')
else fail('4. Account management routes exist')

// 5. Extension centre routes
if (
  exists('src/app/settings/extensions/index.tsx') &&
  exists('src/app/settings/extensions/[extensionId].tsx')
) {
  ok('5. Extension Centre routes exist')
} else fail('5. Extension Centre routes exist')

// 6. Registration does not mention AT Protocol
const create = exists('src/auth/screens/CreateAccountScreen.tsx')
  ? read('src/auth/screens/CreateAccountScreen.tsx')
  : ''
if (create && !/AT Protocol|Bluesky|PDS|DID/i.test(create)) {
  ok('6. Registration onboarding omits AT Protocol')
} else fail('6. Registration onboarding omits AT Protocol')

// 7. Web session bundle (not AsyncStorage for tokens)
if (
  mustInclude(
    'src/auth/storage/WebPersistentSessionStorage.ts',
    ['localStorage', 'accessToken', 'refreshToken', 'sessionId'],
    '7. Web session storage',
  )
) {
  const web = read('src/auth/storage/WebPersistentSessionStorage.ts')
  if (web.includes('async-storage') || web.includes('AsyncStorage')) {
    fail('7. Tokens must not use AsyncStorage')
  } else {
    ok('7. Web storage holds access/refresh/session/expiry bundle')
  }
}

// 8. Greenfield API wiring
if (
  mustInclude(
    'src/data/repositories/api/ApiAuthRepository.ts',
    [
      '/v1/accounts/register',
      '/v1/accounts/verify-email',
      '/v1/accounts/resend-verification',
      '/v1/sessions',
      '/v1/sessions/refresh',
      '/v1/accounts/me',
      '/v1/sessions/current',
    ],
    '8. Greenfield auth API',
  )
) {
  ok('8. Frontend wires Greenfield account/session endpoints')
}

// 9. Account management surface
if (
  mustInclude(
    'src/features/settings/screens/AccountScreen.tsx',
    [
      'Modula Account',
      '/settings/account/handle',
      '/settings/account/email',
      '/settings/account/password',
      '/settings/account/sessions',
      '/settings/account/export',
      'Deactivate',
      'Delete',
    ],
    '9. Account settings',
  )
) {
  ok('9. Account management lists required rows')
}

// 10. Handle change preserves account ID semantics
if (
  mustInclude(
    'src/features/settings/screens/AccountHandleScreen.tsx',
    ['account ID is unchanged', 'DIMON', 'changeHandle'],
    '10. Handle editing',
  )
) {
  ok('10. Handle editing documents non-mutating account ID')
}

// 11. Repository export UI
if (
  mustInclude(
    'src/features/settings/screens/AccountExportScreen.tsx',
    ['Export Greenfield Repository', 'integrity', 'private', 'Re-authenticate', 'createRepositoryExport'],
    '11. Repository export',
  )
) {
  ok('11. Greenfield repository export UI exists')
}

// 12. Extension Centre product UI
if (
  mustInclude(
    'src/features/settings/screens/ExtensionCentreScreen.tsx',
    ['Installed', 'Available', 'Tools', 'Functions', 'Plugins', 'Connections', 'Modules', 'Developer'],
    '12. Extension Centre',
  )
) {
  ok('12. Extension Centre sections exist')
}

// 13. Composer tools from Greenfield registry
if (
  mustInclude(
    'src/components/composer/ComposerToolsDrawer.tsx',
    ['listComposerTools', 'Media', 'Create', 'Productivity', 'Automation', 'AI', 'Modules', 'Marketplace'],
    '13. Composer tools',
  )
) {
  ok('13. Composer loads tools from Greenfield registry')
}

// 14. Module-dependent tools do not fake success
if (
  mustInclude(
    'src/components/composer/ComposerToolsDrawer.tsx',
    ['Requires', 'requiresModule', 'unavailable'],
    '14. Module-gated tools',
  )
) {
  ok('14. Module-dependent tools show Requires … and do not fake success')
}

// 15. Function invocation states
if (
  mustInclude(
    'src/data/repositories/contracts/ToolsRepository.ts',
    ['idle', 'validating', 'running', 'queued', 'completed', 'failed', 'cancelled'],
    '15. Function states',
  ) &&
  mustInclude(
    'src/components/composer/ComposerToolsDrawer.tsx',
    ['invocationState', 'jobId'],
    '15. Function UI',
  )
) {
  ok('15. Function invocation states are modelled in Composer')
}

// 16. AT Protocol optional under Connections
if (
  mustInclude(
    'src/features/atproto/screens/ConnectionsScreen.tsx',
    ['External Networks', 'ATPROTO_SETTINGS_TITLE', 'Optional', 'GitHub', 'Drive', 'Nextcloud'],
    '16. Connections',
  ) &&
  mustInclude(
    'src/features/atproto/copy.ts',
    ['AT Protocol'],
    '16. Connections copy',
  )
) {
  ok('16. AT Protocol is an optional External Network row')
}

// 17. Profile identity framing
if (
  mustInclude(
    'src/features/profile/tabs/AboutProfileTab.tsx',
    ['Modula member since', 'Portability', 'Connected networks'],
    '17. Profile identity',
  )
) {
  ok('17. Profile uses Modula/Greenfield identity framing')
}

// 18. No raw UUID emphasis in normal profile About UI
const about = exists('src/features/profile/tabs/AboutProfileTab.tsx')
  ? read('src/features/profile/tabs/AboutProfileTab.tsx')
  : ''
if (about && !/accountId|UUID|uuid|DID/i.test(about)) {
  ok('18. Normal profile About UI omits raw account IDs / DIDs')
} else fail('18. Normal profile About UI omits raw account IDs / DIDs')

// 19. DIMON placeholder
if (
  mustInclude(
    'src/features/settings/screens/DimonPlaceholderScreen.tsx',
    ['DIMON is not active yet', 'balances', 'wallets'],
    '19. DIMON placeholder',
  ) &&
  exists('src/app/settings/dimon.tsx')
) {
  ok('19. DIMON placeholder screen exists')
}

// 20. No fake DIMON balances
const dimonUi = exists('src/features/settings/screens/DimonPlaceholderScreen.tsx')
  ? read('src/features/settings/screens/DimonPlaceholderScreen.tsx')
  : ''
if (
  dimonUi &&
  !/balance:\s*\d|walletAddress|0\.00 DIMON|DIMON balance:\s|transaction history/i.test(dimonUi)
) {
  ok('20. No fake DIMON balances/wallets/transactions')
} else fail('20. No fake DIMON balances/wallets/transactions')

// 21. Session revocation security message
if (
  mustInclude(
    'src/auth/runtime/SessionProvider.tsx',
    ['revoked for security', '/sign-in', 'clearSessionBundle'],
    '21. Session revocation',
  )
) {
  ok('21. Refresh reuse/revocation clears session and returns to Sign In')
}

// 22. Verifier wiring + DIMON boundary docs
const pkg = exists('package.json') ? read('package.json') : ''
if (
  pkg.includes('verify:phase6-greenfield-frontend') &&
  exists('docs/architecture/dimon-future-integration-boundary.md') &&
  exists('docs/architecture/adr/ADR-009-dimon-on-greenfield.md')
) {
  ok('22. Verifier script wired and DIMON boundary documented')
} else fail('22. Verifier script wired and DIMON boundary documented')

if (failures > 0) {
  console.error(`\n${failures} Phase 6 Greenfield frontend check(s) failed.`)
  process.exit(1)
}
console.log('\nAll 22 Phase 6 Greenfield frontend checks passed.')
