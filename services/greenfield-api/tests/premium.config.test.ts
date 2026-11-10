import {describe, expect, it} from 'vitest'
import {loadConfig} from '../src/config/env.js'

function configEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'test',
    MODULA_ENVIRONMENT: 'development',
    MODULA_API_HOST: '127.0.0.1',
    MODULA_API_PORT: '4098',
    MODULA_PUBLIC_API_URL: 'https://api.test.modula.digital',
    MODULA_DATABASE_URL: 'postgres://test:test@127.0.0.1:5432/modula_test',
    MODULA_DATABASE_MIGRATOR_URL: 'postgres://test:test@127.0.0.1:5432/modula_test',
    MODULA_ALLOWED_ORIGINS: 'https://modula.digital',
    ...overrides,
  }
}

describe('Premium and Verification feature configuration', () => {
  it('defaults every feature and QA mutation surface off', () => {
    expect(loadConfig(configEnv()).premium).toEqual({
      enabled: false,
      qaAssignmentsEnabled: false,
      verificationEnabled: false,
      verificationQaReviewEnabled: false,
      appleSandbox: {
        enabled: false,
        bundleId: null,
        rootCaFiles: [],
        onlineChecks: true,
      },
    })
  })

  it('refuses synthetic assignment and review operations in production', () => {
    expect(() => loadConfig(configEnv({MODULA_ENVIRONMENT: 'production', MODULA_PREVIEW_WRITES_ENABLED: 'false', MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED: 'true'}))).toThrow(/MODULA_PREMIUM_QA_ASSIGNMENTS_ENABLED/)
    expect(() => loadConfig(configEnv({MODULA_ENVIRONMENT: 'production', MODULA_PREVIEW_WRITES_ENABLED: 'false', MODULA_VERIFICATION_QA_REVIEW_ENABLED: 'true'}))).toThrow(/MODULA_VERIFICATION_QA_REVIEW_ENABLED/)
    expect(() => loadConfig(configEnv({
      MODULA_ENVIRONMENT: 'production',
      MODULA_PREVIEW_WRITES_ENABLED: 'false',
      MODULA_PREMIUM_ENTITLEMENTS_ENABLED: 'true',
      MODULA_PREMIUM_APPLE_SANDBOX_ENABLED: 'true',
      MODULA_PREMIUM_APPLE_BUNDLE_ID: 'digital.modula.app.native',
      MODULA_PREMIUM_APPLE_ROOT_CA_FILES: '/qa/apple-root.der',
    }))).toThrow(/MODULA_PREMIUM_APPLE_SANDBOX_ENABLED/)
  })

  it('requires complete fail-closed Apple sandbox configuration', () => {
    expect(() => loadConfig(configEnv({
      NODE_ENV: 'production',
      MODULA_PUBLIC_WEB_URL: 'https://modula.digital',
      MODULA_PREMIUM_APPLE_ONLINE_CHECKS_ENABLED: 'false',
    }))).toThrow(/MODULA_PREMIUM_APPLE_ONLINE_CHECKS_ENABLED/)
    expect(() => loadConfig(configEnv({MODULA_PREMIUM_APPLE_SANDBOX_ENABLED: 'true'}))).toThrow(/MODULA_PREMIUM_ENTITLEMENTS_ENABLED/)
    expect(() => loadConfig(configEnv({
      MODULA_PREMIUM_ENTITLEMENTS_ENABLED: 'true',
      MODULA_PREMIUM_APPLE_SANDBOX_ENABLED: 'true',
    }))).toThrow(/MODULA_PREMIUM_APPLE_BUNDLE_ID/)
    expect(() => loadConfig(configEnv({
      MODULA_PREMIUM_ENTITLEMENTS_ENABLED: 'true',
      MODULA_PREMIUM_APPLE_SANDBOX_ENABLED: 'true',
      MODULA_PREMIUM_APPLE_BUNDLE_ID: 'digital.modula.app.native',
    }))).toThrow(/MODULA_PREMIUM_APPLE_ROOT_CA_FILES/)
    expect(loadConfig(configEnv({
      MODULA_ENVIRONMENT: 'preview',
      MODULA_PREMIUM_ENTITLEMENTS_ENABLED: 'true',
      MODULA_PREMIUM_APPLE_SANDBOX_ENABLED: 'true',
      MODULA_PREMIUM_APPLE_BUNDLE_ID: 'digital.modula.app.native',
      MODULA_PREMIUM_APPLE_ROOT_CA_FILES: '/qa/apple-root-a.der,/qa/apple-root-b.der',
    })).premium.appleSandbox).toEqual({
      enabled: true,
      bundleId: 'digital.modula.app.native',
      rootCaFiles: ['/qa/apple-root-a.der', '/qa/apple-root-b.der'],
      onlineChecks: true,
    })
  })
})
