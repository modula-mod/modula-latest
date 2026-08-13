#!/usr/bin/env node
import {existsSync, readFileSync} from 'node:fs'
import {join} from 'node:path'

const root = process.cwd()
const failures = []

function read(rel) {
  const abs = join(root, rel)
  if (!existsSync(abs)) {
    failures.push(`missing ${rel}`)
    return ''
  }
  return readFileSync(abs, 'utf8')
}

function check(label, ok) {
  console.log(`${label.padEnd(28)} ${ok ? 'PASS' : 'FAIL'}`)
  if (!ok) failures.push(label)
}

function includesAll(rel, needles) {
  const body = read(rel)
  return needles.every(needle =>
    typeof needle === 'string' ? body.includes(needle) : needle.test(body),
  )
}

const webStorage = read('src/auth/storage/WebPersistentSessionStorage.ts')
const createStorage = read('src/auth/storage/createSessionStorage.ts')
const storageIndex = read('src/auth/storage/index.ts')
const sessionTokens = read('src/auth/contracts/SessionTokens.ts')
const decodeSession = read('src/api/decoding/decodeSession.ts')
const apiAuth = read('src/data/repositories/api/ApiAuthRepository.ts')
const provider = read('src/auth/runtime/SessionProvider.tsx')
const coordinator = read('src/auth/runtime/SessionRefreshCoordinator.ts')
const exportScreen = read('src/features/settings/screens/AccountExportScreen.tsx')
const policy = read('docs/architecture/session-and-token-policy.md')
const threatModel = read('docs/security/phase4-session-threat-model.md')

check('WEB STORAGE FILE', existsSync(join(root, 'src/auth/storage/WebPersistentSessionStorage.ts')))
check('OLD WEB MEMORY FILE ABSENT', !existsSync(join(root, 'src/auth/storage/WebMemorySessionStorage.ts')))
check('WEB STORAGE KEY', webStorage.includes("WEB_SESSION_BUNDLE_KEY = 'modula.web.session.bundle.v1'"))
check('WEB USES LOCALSTORAGE', webStorage.includes('localStorage') && webStorage.includes('setItem') && webStorage.includes('removeItem'))
check('WEB PARSES OPAQUE TOKENS', webStorage.includes('parseAccessToken') && webStorage.includes('parseRefreshToken'))
check('WEB CLEARS EXPIRED REFRESH', webStorage.includes('isExpired(value.refreshTokenExpiresAt)') && webStorage.includes('removeItem(WEB_SESSION_BUNDLE_KEY)'))
check('WEB NO ASYNCSTORAGE', !/AsyncStorage|@react-native-async-storage/.test(webStorage))
check('CREATE STORAGE WEB OWNER', createStorage.includes('WebPersistentSessionStorage') && !createStorage.includes('WebMemorySessionStorage'))
check('STORAGE INDEX EXPORT', storageIndex.includes('WebPersistentSessionStorage') && !storageIndex.includes('WebMemorySessionStorage'))
check('REFRESH EXPIRY CONTRACT', sessionTokens.includes('refreshTokenExpiresAt?: string'))
check('DECODE REFRESH EXPIRY', decodeSession.includes('refreshTokenExpiresAt') && decodeSession.includes('refreshExpiresAt'))
check('AUTH RETURNS REFRESH EXPIRY', apiAuth.includes('refreshTokenExpiresAt: tokens.refreshExpiresAt'))
check('PROVIDER STORES EXPIRY', (provider.match(/refreshTokenExpiresAt: .*tokens\.refreshTokenExpiresAt/g) ?? []).length >= 3)
check('COORDINATOR STORES EXPIRY', coordinator.includes('refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt'))
check('EXPORT REAUTH STORES EXPIRY', exportScreen.includes('refreshTokenExpiresAt: result.tokens.refreshTokenExpiresAt'))
check('SECURITY POLICY DOCUMENTED', includesAll('docs/architecture/session-and-token-policy.md', [
  'WebPersistentSessionStorage',
  'modula.web.session.bundle.v1',
  'HTTP-only cookie',
  'XSS implication',
  'POST /v1/sessions/refresh',
  'logout',
]))
check('THREAT MODEL UPDATED', threatModel.includes('web session persistence isolated to `WebPersistentSessionStorage`'))
check('PHASE4 VERIFIER UPDATED', includesAll('scripts/verify-phase4-data-auth.mjs', [
  'WebPersistentSessionStorage.ts',
  'modula.web.session.bundle.v1',
  "file !== 'src/auth/storage/WebPersistentSessionStorage.ts'",
]))

if (failures.length > 0) {
  console.error('\nPhase 7L-B session verifier failed:')
  for (const failure of failures) console.error(`- ${failure}`)
  process.exit(1)
}

console.log('\nPhase 7L-B session verifier passed.')
