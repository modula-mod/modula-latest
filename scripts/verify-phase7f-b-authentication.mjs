#!/usr/bin/env node
/**
 * Phase 7F-B — static auth surface audit (screens, SecureStore, no hardcoded tokens).
 */
import {existsSync, readdirSync, readFileSync, statSync} from 'node:fs'
import {join, relative} from 'node:path'

const root = process.cwd()
const errors = []

function read(rel) {
  const abs = join(root, rel)
  if (!existsSync(abs)) {
    errors.push(`missing ${rel}`)
    return ''
  }
  return readFileSync(abs, 'utf8')
}

function requireFile(rel) {
  if (!existsSync(join(root, rel))) errors.push(`missing ${rel}`)
}

const authScreens = [
  'src/auth/screens/CreateAccountScreen.tsx',
  'src/auth/screens/VerifyEmailScreen.tsx',
  'src/auth/screens/SignInScreen.tsx',
  'src/auth/screens/ForgotPasswordScreen.tsx',
  'src/auth/screens/ResetPasswordScreen.tsx',
]
for (const rel of authScreens) requireFile(rel)

const sessionStorageFiles = [
  'src/auth/storage/WebPersistentSessionStorage.ts',
  'src/auth/storage/SessionStorage.ts',
  'src/auth/storage/createSessionStorage.ts',
]
for (const rel of sessionStorageFiles) requireFile(rel)

const webStore = read('src/auth/storage/WebPersistentSessionStorage.ts')
if (!webStore.includes('localStorage')) {
  errors.push('WebPersistentSessionStorage must use localStorage')
}

const createAccount = read('src/auth/screens/CreateAccountScreen.tsx')
if (!createAccount.includes('ModulaCheckbox')) {
  errors.push('CreateAccountScreen must use ModulaCheckbox for terms/privacy')
}
if (!/terms|privacy/i.test(createAccount)) {
  errors.push('CreateAccountScreen must reference terms/privacy acceptance')
}

const primitives = read('src/auth/screens/AuthScreenPrimitives.tsx')
for (const needle of ['ModulaTextInput', 'ModulaSecureInput', 'ModulaButton']) {
  if (!primitives.includes(needle)) {
    errors.push(`AuthScreenPrimitives must use ${needle}`)
  }
}

// No hardcoded production tokens / secrets in src/auth
const tokenPatterns = [
  /(?:sk|pk|rk)_live_[A-Za-z0-9]{16,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/,
  /Bearer\s+[A-Za-z0-9._-]{24,}/,
  /(?:access|refresh|api)[_-]?token\s*[:=]\s*['"][A-Za-z0-9._-]{24,}['"]/i,
]

// Local-simulator bootstrap password is allowed; production-looking secrets are not.
const allowedLocalSecrets = [/modula-local-password/]

function walkAuth(dir, visit) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    const stats = statSync(abs)
    if (stats.isDirectory()) walkAuth(abs, visit)
    else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry)) visit(abs)
  }
}

walkAuth(join(root, 'src/auth'), abs => {
  const rel = relative(root, abs)
  const text = readFileSync(abs, 'utf8')
  const lines = text.split(/\r?\n/)
  for (const [index, line] of lines.entries()) {
    if (/^\s*(\/\/|\*|\/\*)/.test(line)) continue
    if (allowedLocalSecrets.some(pattern => pattern.test(line))) continue
    for (const pattern of tokenPatterns) {
      if (pattern.test(line)) {
        errors.push(`hardcoded production token candidate ${rel}:${index + 1}`)
      }
    }
    // Flag non-local hardcoded password literals that look like real secrets
    if (/password\s*[:=]\s*['"][^'"]{12,}['"]/i.test(line) && !/local|example|placeholder|test/i.test(line)) {
      errors.push(`hardcoded password literal ${rel}:${index + 1}`)
    }
  }
})

if (errors.length) {
  console.error('Phase 7F-B authentication verification failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exit(1)
}

console.log('Phase 7F-B authentication verification passed.')
