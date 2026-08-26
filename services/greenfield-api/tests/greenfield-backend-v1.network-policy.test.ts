import {describe, expect, it} from 'vitest'
import type {ModuleBackendDefinition} from '@modula/greenfield-module-manifest'
import {assertBackendTargetPolicy} from '../src/modules/backend/network-policy.js'

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
