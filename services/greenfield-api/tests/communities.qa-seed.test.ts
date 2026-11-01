import {afterEach, describe, expect, it} from 'vitest'
import {assertQaFixtureBoundary} from '../seeds/communities-qa-seed.js'

describe('Communities QA fixture safety boundary', () => {
  const previousEnabled = process.env.MODULA_QA_FIXTURES_ENABLED
  const previousEnvironment = process.env.MODULA_ENVIRONMENT

  afterEach(() => {
    restore('MODULA_QA_FIXTURES_ENABLED', previousEnabled)
    restore('MODULA_ENVIRONMENT', previousEnvironment)
  })

  it('accepts only explicit QA fixtures on loopback with a QA-named database', () => {
    process.env.MODULA_QA_FIXTURES_ENABLED = 'true'
    process.env.MODULA_ENVIRONMENT = 'development'
    expect(() => assertQaFixtureBoundary('postgresql://user:password@127.0.0.1:55483/modula_feature_reality_01_pr04_test')).not.toThrow()
  })

  it('refuses missing opt-in, production environment, remote hosts and production-like database names', () => {
    process.env.MODULA_ENVIRONMENT = 'development'
    delete process.env.MODULA_QA_FIXTURES_ENABLED
    expect(() => assertQaFixtureBoundary('postgresql://user:password@127.0.0.1/modula_qa')).toThrow(/MODULA_QA_FIXTURES_ENABLED/)

    process.env.MODULA_QA_FIXTURES_ENABLED = 'true'
    process.env.MODULA_ENVIRONMENT = 'production'
    expect(() => assertQaFixtureBoundary('postgresql://user:password@127.0.0.1/modula_qa')).toThrow(/non-QA/)

    process.env.MODULA_ENVIRONMENT = 'test'
    expect(() => assertQaFixtureBoundary('postgresql://user:password@db.internal/modula_qa')).toThrow(/loopback/)
    expect(() => assertQaFixtureBoundary('postgresql://user:password@127.0.0.1/modula_production')).toThrow(/QA\/test-named/)
  })
})

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key]
  else process.env[key] = value
}
