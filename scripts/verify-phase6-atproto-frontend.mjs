import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root = process.cwd()
const errors = []

function fail(message) {
  errors.push(message)
}

function filePath(file) {
  return path.join(root, file)
}

function exists(file) {
  return fs.existsSync(filePath(file))
}

function text(file) {
  return fs.readFileSync(filePath(file), 'utf8')
}

function readJson(file) {
  return JSON.parse(text(file))
}

function walk(dir) {
  const absolute = filePath(dir)
  if (!fs.existsSync(absolute)) return []
  return fs.readdirSync(absolute, {withFileTypes: true}).flatMap(entry => {
    const full = path.join(absolute, entry.name)
    const relative = path.relative(root, full)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.git') {
        return []
      }
      return walk(relative)
    }
    return [relative]
  })
}

function requireFile(file, message) {
  if (!exists(file)) fail(message ?? `Missing required file: ${file}`)
}

function requireText(file, pattern, message) {
  if (!exists(file)) {
    fail(`Missing file for check: ${file}`)
    return
  }
  const body = text(file)
  const matched = typeof pattern === 'string' ? body.includes(pattern) : pattern.test(body)
  if (!matched) fail(message)
}

function srcFiles() {
  return walk('src').filter(file => file.endsWith('.ts') || file.endsWith('.tsx'))
}

const pkg = readJson('package.json')
const deps = {...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {})}
const phase7cReconciled = exists('docs/validation/phase7c-verifier-reconciliation.md')

console.log('Phase 6 AT Protocol frontend verifier\n')

// 1. Connected Accounts route exists.
requireFile(
  'src/app/settings/connections/index.tsx',
  '1. Connected Accounts route missing (src/app/settings/connections/index.tsx)',
)

// 2. AT settings route exists.
requireFile(
  'src/app/settings/connections/atproto.tsx',
  '2. AT settings route missing (src/app/settings/connections/atproto.tsx)',
)

// 3. Official Expo OAuth client is used.
if (!Object.prototype.hasOwnProperty.call(deps, '@atproto/oauth-client-expo')) {
  fail('3. Missing dependency @atproto/oauth-client-expo')
}
requireText(
  'src/features/atproto/oauth/atprotoOAuthClient.native.ts',
  /from '@atproto\/oauth-client-expo'/,
  '3. Official Expo OAuth client is not imported',
)
requireText(
  'src/features/atproto/oauth/atprotoOAuthClient.native.ts',
  'ExpoOAuthClient',
  '3. ExpoOAuthClient is not referenced',
)

// 4. Native callback exists.
requireFile('src/app/oauth/atproto.tsx', '4. Native OAuth callback route missing')
requireText(
  'src/features/atproto/screens/AtprotoOAuthCallbackScreen.tsx',
  'modula://oauth/atproto',
  '4. Native callback does not document modula://oauth/atproto',
)

// 5. OAuth state is validated.
requireText(
  'src/features/atproto/oauth/completeAtprotoOAuth.ts',
  'pending.state',
  '5. OAuth state validation missing',
)
requireText(
  'src/features/atproto/oauth/completeAtprotoOAuth.ts',
  'OAuth state mismatch',
  '5. OAuth state mismatch handling missing',
)

// 6. Tokens are not stored in AsyncStorage.
const asyncStorageTokenHits = srcFiles().filter(file => {
  if (!file.includes('atproto')) return false
  const body = text(file)
  return (
    body.includes('AsyncStorage') &&
    (/access_token|refresh_token|accessToken|refreshToken/.test(body) ||
      body.includes('setItem'))
  )
})
if (asyncStorageTokenHits.length) {
  fail(`6. AT Protocol tokens appear to use AsyncStorage in: ${asyncStorageTokenHits.join(', ')}`)
}

// 7. Tokens are never displayed.
const tokenDisplayHits = srcFiles().filter(file => {
  if (!file.includes('atproto')) return false
  const body = text(file)
  return /accessToken|refreshToken|access_token|refresh_token/.test(body) &&
    /AppText|Text\s*>|display|showToken/.test(body)
})
if (tokenDisplayHits.length) {
  fail(`7. Possible AT token display in: ${tokenDisplayHits.join(', ')}`)
}
requireText(
  'src/features/atproto/screens/AtprotoConnectionScreen.tsx',
  'Tokens are never stored or displayed',
  '7. Explicit no-token display copy missing on AT settings',
)

// 8. Public-data warning exists.
requireText(
  'src/features/atproto/copy.ts',
  'AT Protocol repositories contain public records.',
  '8. Public-data warning copy missing',
)
requireFile(
  'src/features/atproto/components/PublicDataWarning.tsx',
  '8. PublicDataWarning component missing',
)

// 9. Default destination is Modula only.
requireText(
  'src/features/atproto/copy.ts',
  "DEFAULT_PUBLISHING_DESTINATION = 'modula'",
  '9. Default publishing destination is not Modula only',
)
requireText(
  'src/features/atproto/publishing/canCrossPost.ts',
  'DEFAULT_PUBLISHING_DESTINATION',
  '9. Default destination helper missing',
)

// 10. Private posts cannot cross-post.
requireText(
  'src/features/atproto/publishing/canCrossPost.ts',
  'followersAudience',
  '10. Follower-only cross-post prohibition missing',
)
requireText(
  'src/features/atproto/publishing/canCrossPost.ts',
  'privateAudience',
  '10. Private audience cross-post prohibition missing',
)

// 11. Composer destination selector exists.
requireText(
  'src/features/composer/screens/ComposerScreen.tsx',
  'Publish to',
  '11. Composer destination selector missing',
)
requireText(
  'src/features/composer/screens/ComposerScreen.tsx',
  'modula+atproto',
  '11. Composer Modula + AT Protocol destination missing',
)

// 12. Publication states exist.
requireText(
  'src/features/atproto/copy.ts',
  'Published on Modula',
  '12. Publication status "Published on Modula" missing',
)
requireText(
  'src/features/atproto/copy.ts',
  'Publishing to AT Protocol',
  '12. Publication status "Publishing to AT Protocol" missing',
)
requireText(
  'src/features/atproto/copy.ts',
  'AT publishing needs attention',
  '12. Publication status needs-attention missing',
)
requireFile(
  'src/features/atproto/components/PublicationStatusBanner.tsx',
  '12. PublicationStatusBanner missing',
)

// 13. Atmosphere Preview exists. Phase 7C demotes the optional bridge preview
// from primary Discover IA, but the gated preview component and copy remain.
if (phase7cReconciled) {
  requireText(
    'src/features/atproto/copy.ts',
    'External network preview',
    '13. Optional external network preview copy missing',
  )
  requireFile(
    'src/features/atproto/components/AtmospherePreviewSection.tsx',
    '13. AtmospherePreviewSection missing',
  )
} else {
  requireText(
    'src/features/atproto/copy.ts',
    'Atmosphere Preview',
    '13. Atmosphere Preview label missing',
  )
  requireFile(
    'src/features/atproto/components/AtmospherePreviewSection.tsx',
    '13. AtmospherePreviewSection missing',
  )
  requireText(
    'src/features/discover/screens/DiscoverScreen.tsx',
    'AtmospherePreviewSection',
    '13. Atmosphere Preview not wired into Discover',
  )
}

// 14. Imported content displays origin.
requireFile(
  'src/features/atproto/components/OriginLabel.tsx',
  '14. OriginLabel missing',
)
requireText(
  'src/features/atproto/copy.ts',
  "atproto: 'AT Protocol'",
  '14. Origin labels missing',
)

// 15. Profile AT connection appears in About. Phase 7C keeps optional network
// connections in Settings rather than the core profile About tab.
if (phase7cReconciled) {
  requireFile(
    'src/app/settings/connections/atproto.tsx',
    '15. AT connection settings route missing',
  )
} else {
  requireText(
    'src/features/profile/tabs/AboutProfileTab.tsx',
    'Connected to AT Protocol',
    '15. Profile About AT connection line missing',
  )
}

// 16. API capabilities control availability.
requireText(
  'src/features/atproto/data/useApiMetadataQuery.ts',
  'atprotoOAuth',
  '16. atprotoOAuth capability gating missing',
)
requireText(
  'src/features/atproto/data/useApiMetadataQuery.ts',
  'atprotoPublishing',
  '16. atprotoPublishing capability gating missing',
)
requireText(
  'src/features/atproto/data/useApiMetadataQuery.ts',
  'atprotoImport',
  '16. atprotoImport capability gating missing',
)
requireText(
  'src/features/atproto/data/useApiMetadataQuery.ts',
  'pdsPilot',
  '16. pdsPilot capability gating missing',
)

// 17. No app-password UI exists.
const appPasswordHits = srcFiles().filter(file => {
  const body = text(file).toLowerCase()
  return body.includes('app password') || body.includes('app-password') || body.includes('apppassword')
})
if (appPasswordHits.length) {
  fail(`17. App-password UI references found in: ${appPasswordHits.join(', ')}`)
}

// 18. No custom OAuth implementation exists.
const customOauthHits = srcFiles().filter(file => {
  if (!file.includes('atproto')) return false
  // Official client metadata may mention dpop_bound_access_tokens — that is not custom crypto.
  if (file.includes('atprotoOAuthClient')) return false
  const body = text(file)
  return /createHash\(|subtle\.digest|pkce|code_verifier|generateKeyPair/i.test(body)
})
if (customOauthHits.length) {
  fail(`18. Custom OAuth/PKCE/DPoP implementation suspected in: ${customOauthHits.join(', ')}`)
}
requireText(
  'src/features/atproto/oauth/startAtprotoOAuth.ts',
  'getAtprotoExpoOAuthClient',
  '18. OAuth start path must initialize the official Expo client surface',
)
requireText(
  'src/features/atproto/oauth/atprotoOAuthClient.native.ts',
  "from '@atproto/oauth-client-expo'",
  '18. Custom OAuth client is forbidden; official Expo package required',
)

// 19. Previous verifiers remain.
for (const script of [
  'verify:phase1',
  'verify:phase2',
  'verify:theme',
  'verify:phase3',
  'verify:phase4',
  'verify:phase5',
]) {
  if (!pkg.scripts?.[script]) {
    fail(`19. Missing previous verifier script: ${script}`)
  }
}
if (pkg.scripts?.['verify:phase6-frontend'] !== 'node scripts/verify-phase6-atproto-frontend.mjs') {
  fail('19. package.json must expose verify:phase6-frontend')
}

// 20. iOS native build documentation is updated.
requireFile(
  'docs/validation/phase6-native-atproto-oauth.md',
  '20. Native AT Protocol OAuth acceptance docs missing',
)
requireText(
  'docs/validation/phase6-native-atproto-oauth.md',
  'Simulator',
  '20. Simulator testing notes missing',
)
requireText(
  'docs/validation/phase6-native-atproto-oauth.md',
  'physical iPhone',
  '20. Physical iPhone testing notes missing',
)
requireText(
  'docs/validation/phase6-native-atproto-oauth.md',
  'Expo Go is not authoritative',
  '20. Expo Go disclaimer missing',
)

if (errors.length) {
  console.error('FAIL\n')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('PASS — Phase 6 AT Protocol frontend checks (20/20)')
