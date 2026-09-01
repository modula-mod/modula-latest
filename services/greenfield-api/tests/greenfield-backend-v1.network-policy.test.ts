import {describe, expect, it} from 'vitest'
import type {ModuleBackendDefinition} from '@modula/greenfield-module-manifest'
import {assertBackendTargetPolicy, resolveBackendEndpoint} from '../src/modules/backend/network-policy.js'
import {safeLookup} from '../src/security/ssrf.js'

describe('Greenfield Backend V1 registered service target policy', () => {
  it('accepts an exact registered HTTPS origin on an allowed port', () => {
    expect(() => assertBackendTargetPolicy(backend({
      strategy: 'registry',
      origins: ['https://api.example.com'],
      hosts: ['api.example.com'],
      ports: [443],
    }), new URL('https://api.example.com'), true)).not.toThrow()
  })

  it('rejects a caller-selected origin when neither its origin nor host is declared', () => {
    expect(() => assertBackendTargetPolicy(backend({
      strategy: 'self-hosted',
      origins: ['https://managed.example.com'],
      hosts: [],
      ports: [443],
    }), new URL('https://attacker.example.net'), true)).toThrowError(expect.objectContaining({code: 'FORBIDDEN'}))
  })

  it('permits a reviewed self-hosted hostname only on an explicitly allowed custom port', () => {
    const definition = backend({
      strategy: 'self-hosted',
      origins: ['https://managed.example.com'],
      hosts: ['customer.example.net'],
      ports: [8443],
    })
    expect(() => assertBackendTargetPolicy(definition, new URL('https://customer.example.net:8443'), true)).not.toThrow()
    expect(() => assertBackendTargetPolicy(definition, new URL('https://customer.example.net'), true)).toThrowError(expect.objectContaining({code: 'FORBIDDEN'}))
  })

  it('does not let registry strategies substitute another origin even on a declared host', () => {
    expect(() => assertBackendTargetPolicy(backend({
      strategy: 'registry',
      origins: ['https://api.example.com'],
      hosts: ['api.example.com'],
      ports: [443, 8443],
    }), new URL('https://api.example.com:8443'), true)).toThrowError(expect.objectContaining({code: 'FORBIDDEN'}))
  })

  it('rejects origins containing a path, query or fragment', () => {
    expect(() => assertBackendTargetPolicy(backend({
      strategy: 'self-hosted',
      origins: ['https://api.example.com'],
      hosts: ['api.example.com'],
      ports: [443],
    }), new URL('https://api.example.com/backend?tenant=one'), true)).toThrowError(expect.objectContaining({code: 'VALIDATION_FAILED'}))
  })

  it('keeps every resolved service path on the exact registered origin', async () => {
    const definition = backend({
      strategy: 'registry',
      origins: ['https://8.8.8.8'],
      hosts: ['8.8.8.8'],
      ports: [443],
    })
    const resolved = await resolveBackendEndpoint(definition)
    expect(resolved.urlFor('/v1/actions?kind=verify')).toBe('https://8.8.8.8/v1/actions?kind=verify')
    for (const maliciousPath of ['//attacker.example/v1', '/../admin', '/%2e%2e/admin', '/%2f%2fattacker.example/v1', '/%5c%5cattacker.example/v1', '/v1#fragment']) {
      expect(() => resolved.urlFor(maliciousPath)).toThrowError(expect.objectContaining({code: 'VALIDATION_FAILED'}))
    }
  })

  it('returns the address-array callback shape requested by Node 24 HTTPS lookups', async () => {
    const addresses = await new Promise<import('node:dns').LookupAddress[]>((resolve, reject) => {
      safeLookup('8.8.8.8', {all: true}, (error, resolved) => {
        if (error) reject(error)
        else resolve(resolved)
      })
    })
    expect(addresses).toEqual([{address: '8.8.8.8', family: 4}])

    await new Promise<void>((resolve, reject) => {
      safeLookup('127.0.0.1', {all: true}, (error, resolved) => {
        try {
          expect(error).toBeInstanceOf(Error)
          expect(resolved).toEqual([])
          resolve()
        } catch (assertionError) {
          reject(assertionError)
        }
      })
    })
  })
})

function backend(input: {strategy: 'registry' | 'self-hosted'; origins: string[]; hosts: string[]; ports: number[]}): ModuleBackendDefinition {
  return {
    mode: 'module-managed',
    endpoints: {
      baseUrlStrategy: input.strategy,
      apiVersion: 'v1',
      healthPath: '/v1/health',
      allowedHosts: input.hosts,
    },
    trust: {
      publisherId: 'test.publisher',
      allowedOrigins: input.origins,
    },
    network: {allowedPorts: input.ports},
  }
}
