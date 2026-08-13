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
    if (entry.isDirectory()) return walk(relative)
    return [relative]
  })
}

function requireFile(file) {
  if (!exists(file)) fail(`Missing required Phase 4 file: ${file}`)
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

const pkg = readJson('package.json')
const deps = pkg.dependencies ?? {}
const devDeps = pkg.devDependencies ?? {}
const allDeps = {...deps, ...devDeps}

for (const dependency of ['@tanstack/react-query', 'expo-secure-store', 'expo-network']) {
  if (!Object.prototype.hasOwnProperty.call(deps, dependency)) {
    fail(`Missing Phase 4 dependency: ${dependency}`)
  }
}

for (const forbidden of [
  'axios',
  'swr',
  '@reduxjs/toolkit',
  'zustand',
  'mobx',
  'msw',
  '@apollo/client',
  'graphql',
  'firebase',
  '@supabase/supabase-js',
  'appwrite',
  'realm',
  '@nozbe/watermelondb',
  'expo-sqlite',
  '@tanstack/query-persist-client-core',
  '@tanstack/react-query-persist-client',
  'jwt-decode',
  'react-native-worklets-core',
  '@react-native/worklets',
]) {
  if (Object.prototype.hasOwnProperty.call(allDeps, forbidden)) {
    fail(`Forbidden Phase 4 dependency present: ${forbidden}`)
  }
}

// Reanimated/Worklets re-admitted only for Phase 4.5 authorized liquid-glass tabs
const liquidGlassGate =
  exists('src/platform/ui/navigation/liquid-glass-availability.ts') &&
  exists('src/platform/ui/navigation/modula-liquid-glass-tab-bar.tsx')
for (const name of ['react-native-reanimated', 'react-native-worklets']) {
  if (Object.prototype.hasOwnProperty.call(allDeps, name) && !liquidGlassGate) {
    fail(`Forbidden Phase 4 dependency present: ${name}`)
  }
}

if (pkg.scripts?.['verify:phase4'] !== 'node scripts/verify-phase4-data-auth.mjs') {
  fail('package.json must expose verify:phase4')
}

for (const file of [
  'src/config/runtimeEnvironment.ts',
  'src/api/contracts/ApiEnvelope.ts',
  'src/api/contracts/ApiError.ts',
  'src/api/contracts/ApiRequest.ts',
  'src/api/contracts/CursorPage.ts',
  'src/api/contracts/identifiers.ts',
  'src/api/transport/ApiTransport.ts',
  'src/api/transport/HttpApiTransport.ts',
  'src/api/transport/LocalApiTransport.ts',
  'src/api/client/ApiClient.ts',
  'src/api/local/LocalApiServer.ts',
  'src/api/local/LocalApiDatabase.ts',
  'src/api/local/LocalApiRouter.ts',
  'src/api/local/LocalApiConfiguration.ts',
  'src/api/local/LocalTokenIssuer.ts',
  'src/api/local/routes/authRoutes.ts',
  'src/api/local/routes/feedRoutes.ts',
  'src/api/local/routes/postRoutes.ts',
  'src/api/local/routes/profileRoutes.ts',
  'src/api/local/routes/activityRoutes.ts',
  'src/api/local/routes/discoverRoutes.ts',
  'src/api/decoding/decodeApiEnvelope.ts',
  'src/api/decoding/decodeCursorPage.ts',
  'src/api/decoding/decodeSession.ts',
  'src/api/decoding/decodePost.ts',
  'src/api/decoding/decodeProfile.ts',
  'src/api/decoding/decodeActivity.ts',
  'src/api/decoding/decodeDiscover.ts',
  'src/data/repositories/contracts/AuthRepository.ts',
  'src/data/repositories/contracts/FeedRepository.ts',
  'src/data/repositories/contracts/PostRepository.ts',
  'src/data/repositories/contracts/ProfileRepository.ts',
  'src/data/repositories/contracts/SocialGraphRepository.ts',
  'src/data/repositories/contracts/ActivityRepository.ts',
  'src/data/repositories/contracts/DiscoverRepository.ts',
  'src/data/repositories/contracts/ReelsRepository.ts',
  'src/data/repositories/api/ApiAuthRepository.ts',
  'src/data/repositories/api/ApiFeedRepository.ts',
  'src/data/repositories/api/ApiPostRepository.ts',
  'src/data/repositories/api/ApiProfileRepository.ts',
  'src/data/repositories/api/ApiSocialGraphRepository.ts',
  'src/data/repositories/api/ApiActivityRepository.ts',
  'src/data/repositories/api/ApiDiscoverRepository.ts',
  'src/data/repositories/api/ApiReelsRepository.ts',
  'src/runtime/createAppServices.ts',
  'src/runtime/AppServicesProvider.tsx',
  'src/data/query/createQueryClient.ts',
  'src/data/query/QueryRuntimeProvider.tsx',
  'src/data/query/queryKeys.ts',
  'src/data/query/queryRetry.ts',
  'src/data/query/queryOnlineManager.ts',
  'src/data/query/queryFocusManager.ts',
  'src/data/network/NetworkRuntime.tsx',
  'src/data/network/useNetworkStatus.ts',
  'src/auth/contracts/Session.ts',
  'src/auth/contracts/SessionTokens.ts',
  'src/auth/contracts/AuthCapability.ts',
  'src/auth/storage/SessionStorage.ts',
  'src/auth/storage/NativeSecureSessionStorage.ts',
  'src/auth/storage/WebPersistentSessionStorage.ts',
  'src/auth/runtime/SessionProvider.tsx',
  'src/auth/runtime/SessionRefreshCoordinator.ts',
  'src/auth/runtime/AccessTokenStore.ts',
  'src/auth/runtime/useCapability.ts',
  'src/auth/components/ProtectedActionPrompt.tsx',
  'src/auth/capabilities/RequireCapability.tsx',
  'src/auth/navigation/safeReturnTo.ts',
  'src/app/(auth)/welcome.tsx',
  'src/app/(auth)/sign-in.tsx',
  'src/app/(auth)/create-account.tsx',
  'src/app/(auth)/recover.tsx',
  'src/app/settings/account.tsx',
  'src/app/settings/developer/index.tsx',
  'src/app/settings/developer/data-runtime.tsx',
  'src/app/settings/developer/session.tsx',
  'src/components/data/QueryErrorState.tsx',
  'src/components/data/NetworkStatusBanner.tsx',
  'src/features/feed/data/useHomeFeedQuery.ts',
  'src/features/feed/data/useCreatePostMutation.ts',
  'src/features/feed/data/useLikePostMutation.ts',
  'src/features/feed/data/useSavePostMutation.ts',
  'src/features/feed/data/useRepostMutation.ts',
  'src/features/feed/data/updatePostAcrossCache.ts',
  'src/features/profile/data-query/useProfileQuery.ts',
  'src/features/profile/data-query/useFollowProfileMutation.ts',
  'src/features/profile/data-query/useUpdateProfileMutation.ts',
  'src/features/activity/data/useActivityQuery.ts',
  'src/features/discover/data/useDiscoverQuery.ts',
  'src/features/reels/data/useReelsQuery.ts',
  'src/features/saved/data/useSavedPostsQuery.ts',
  'scripts/verify-phase1-shell.mjs',
  'scripts/verify-phase2-appearance.mjs',
  'scripts/verify-phase3-profile.mjs',
]) {
  requireFile(file)
}

for (const file of [
  'docs/architecture/phase4-data-auth-runtime.md',
  'docs/architecture/api-transport-contract.md',
  'docs/architecture/local-api-simulator.md',
  'docs/architecture/repository-boundaries.md',
  'docs/architecture/query-cache-policy.md',
  'docs/architecture/session-and-token-policy.md',
  'docs/architecture/auth-capability-model.md',
  'docs/architecture/server-vs-local-state.md',
  'docs/security/phase4-session-threat-model.md',
  'docs/testing/phase4-data-runtime-test-plan.md',
  'docs/validation/phase4-device-results.md',
  'docs/provenance/phase4-source-provenance.md',
  'docs/audits/phase4-data-ownership-audit.md',
]) {
  requireFile(file)
}

requireText('src/api/transport/ApiTransport.ts', /interface ApiTransport[\s\S]*send\(request: ApiRequest\)/, 'API transport contract is incomplete')
requireText('src/api/transport/HttpApiTransport.ts', "from 'expo/fetch'", 'HTTP transport must use expo/fetch')
requireText('src/api/transport/HttpApiTransport.ts', /fetch\(/, 'HTTP transport does not call fetch')
requireText('src/api/transport/LocalApiTransport.ts', /LocalApiServer/, 'Local transport must use LocalApiServer')
requireText('src/api/local/LocalApiServer.ts', /LocalApiRouter/, 'Local API server must route through LocalApiRouter')
requireText('src/api/contracts/ApiEnvelope.ts', /ok:\s*true[\s\S]*ok:\s*false/, 'API envelope must include success and failure variants')
requireText('src/api/contracts/ApiError.ts', /SESSION_EXPIRED[\s\S]*INVALID_RESPONSE[\s\S]*CANCELLED/, 'API error codes are incomplete')
requireText('src/api/contracts/ApiError.ts', /class ModulaApiError extends Error/, 'ModulaApiError class is missing')
requireText('src/api/contracts/CursorPage.ts', /nextCursor:\s*string \| null[\s\S]*hasMore:\s*boolean/, 'Cursor pagination contract is incomplete')
requireText('src/api/contracts/identifiers.ts', /parseAccountId[\s\S]*parseProfileId[\s\S]*parsePostId[\s\S]*parseSessionId/, 'Branded identifier parsers are missing')
requireText('src/config/runtimeEnvironment.ts', /production[\s\S]*remote/, 'Production remote-mode rule is missing')
requireText('src/auth/storage/SessionStorage.ts', 'modula.session.refresh-token.v1', 'Secure session storage key is incorrect')
requireText('src/auth/storage/NativeSecureSessionStorage.ts', 'expo-secure-store', 'Native session storage must use Expo SecureStore')
requireText('src/auth/storage/WebPersistentSessionStorage.ts', 'modula.web.session.bundle.v1', 'Web session storage key is incorrect')
requireText('src/auth/storage/WebPersistentSessionStorage.ts', /localStorage/, 'Web session storage must persist through localStorage')
requireText('src/auth/contracts/Session.ts', /SessionState[\s\S]*BootingSession[\s\S]*SignedOutSession[\s\S]*GuestSession[\s\S]*AuthenticatedSession[\s\S]*RefreshingSession[\s\S]*ExpiredSession[\s\S]*ErrorSession/, 'Session state must be a discriminated union')
requireText('src/auth/contracts/AuthCapability.ts', /post:create[\s\S]*profile:manage[\s\S]*messages:access[\s\S]*account:manage/, 'Auth capability contract is incomplete')
requireText('src/auth/runtime/SessionRefreshCoordinator.ts', /private inFlight:[\s\S]*Promise/, 'Refresh coordinator must use an in-flight refresh mutex')
requireText('src/features/feed/data/useHomeFeedQuery.ts', /useInfiniteQuery/, 'Home feed must use an infinite query hook')
requireText('src/features/feed/data/useCreatePostMutation.ts', /idempotencyKey/, 'Create-post mutation must carry an idempotency key')
requireText('src/features/profile/runtime/ProfilePresentationProvider.tsx', /presentation/, 'Profile presentation provider must remain presentation-scoped')
requireText('src/app/_layout.tsx', /AppServicesProvider[\s\S]*QueryRuntimeProvider[\s\S]*SessionProvider[\s\S]*ProfilePresentationProvider/, 'Root provider order must include services, query, session and profile presentation providers')
requireText('app.config.ts', /updates:\s*{\s*enabled:\s*false\s*,?\s*}/s, 'OTA updates must remain disabled')

if (exists('src/demo/DemoSocialContext.tsx')) {
  fail('DemoSocialContext must be removed after Phase 4 migration')
}
if (exists('src/features/profile/runtime/ProfileProvider.tsx')) {
  fail('ProfileProvider must be renamed after server profile data moves to queries')
}

const sourceFiles = walk('src').filter(file => /\.(ts|tsx|js|jsx)$/.test(file))
const uiRoots = ['src/app/', 'src/features/', 'src/components/', 'src/shell/']
const asyncStorageBoundaryFiles = new Set([
  'src/theme/storage/appearanceStorage.ts',
  'src/features/onboarding/data/onboardingStorage.ts',
  'src/features/product/storage/localProductStorage.ts',
  'src/features/product/storage/productPreferencesStorage.ts',
  'src/features/profile/storage/profilePresentationStorage.ts',
])
const allowedExternalPreviewHosts = new Set([
  'commondatastorage.googleapis.com',
  'corner-inverter.douiri.org',
  'i.pravatar.cc',
])

for (const file of sourceFiles) {
  const body = text(file)
  const isUiSource = uiRoots.some(prefix => file.startsWith(prefix))
  const isApiTransport = file.startsWith('src/api/transport/')
  const isRuntimeConfig = file === 'src/config/runtimeEnvironment.ts'
  const isLocalApiSource = file.startsWith('src/api/local/')
  const isSessionStorage = file.startsWith('src/auth/storage/')

  if (body.includes('DemoSocialContext') || body.includes('useDemoSocial')) {
    fail(`Legacy DemoSocialContext reference remains: ${file}`)
  }

  if (!isLocalApiSource && /from ['"]@\/api\/local\/seed/.test(body)) {
    fail(`Local API seed data imported outside local API layer: ${file}`)
  }

  if (isUiSource && /from ['"]@\/demo\//.test(body)) {
    fail(`UI source imports demo seed data directly: ${file}`)
  }

  if (!isRuntimeConfig && /process\.env\.EXPO_PUBLIC_/.test(body)) {
    fail(`Direct EXPO_PUBLIC access outside runtimeEnvironment: ${file}`)
  }

  if (!isApiTransport && /\bfetch\s*\(/.test(body)) {
    fail(`fetch is only permitted inside src/api/transport: ${file}`)
  }

  if (!isSessionStorage && /from ['"]expo-secure-store['"]/.test(body)) {
    fail(`SecureStore imported outside auth storage: ${file}`)
  }

  if (
    !asyncStorageBoundaryFiles.has(file) &&
    /from ['"]@react-native-async-storage\/async-storage['"]/.test(body)
  ) {
    fail(`AsyncStorage imported outside approved local-preference storage: ${file}`)
  }

  if (isUiSource && /\bAuthorization\b/.test(body)) {
    fail(`Authorization header logic must not appear in UI source: ${file}`)
  }

  if (
    file !== 'src/auth/storage/WebPersistentSessionStorage.ts' &&
    /localStorage\.setItem\([^)]*token/i.test(body)
  ) {
    fail(`Token-like localStorage write is forbidden: ${file}`)
  }

  if (/AsyncStorage\.setItem\([^)]*(token|accessToken|refreshToken|password)/i.test(body)) {
    fail(`Token-like AsyncStorage write is forbidden: ${file}`)
  }

  if (/console\.(log|warn|error|info)\([^)]*(password|accessToken|refreshToken)/i.test(body)) {
    fail(`Credential or token-like value may be logged: ${file}`)
  }

  if (/queryKey:\s*\[/.test(body)) {
    fail(`Manual query-key array detected; use queryKeys factory: ${file}`)
  }

  const urlMatches = body.match(/https?:\/\/[A-Za-z0-9][A-Za-z0-9.-]*/gi) ?? []
  for (const url of urlMatches) {
    const host = url.replace(/^https?:\/\//i, '')
    const allowed =
      ['localhost', '127.0.0.1', '0.0.0.0', 'github.com'].includes(host) ||
      host === 'modula.digital' ||
      host.endsWith('.modula.digital') ||
      allowedExternalPreviewHosts.has(host)
    if (!allowed) {
      fail(`Possible hardcoded external production URL: ${file}`)
    }
  }
}

if (errors.length) {
  console.error('Phase 4 data/auth verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 4 data/auth verification passed.')
