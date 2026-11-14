import {generateKeyPairSync, sign} from 'node:crypto'
import {mkdtemp, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {afterEach, describe, expect, it} from 'vitest'
import {
  DisposableEd25519SigningProvider,
  SigningProviderError,
  VaultTransitEd25519SigningProvider,
  type PublisherSigningIdentity,
} from '../src/publisher/signing-provider.js'

const now = new Date('2026-11-10T12:00:00.000Z')

function identity(overrides: Partial<PublisherSigningIdentity> = {}): PublisherSigningIdentity {
  return {
    identityId: 'psi_00000000-0000-4000-8000-000000000001',
    publisherId: 'publisher.alpha',
    signingKeyId: 'publisher-alpha-online-1',
    provider: 'DISPOSABLE_TEST',
    providerKeyRef: 'test/publisher-alpha-online-1',
    purpose: 'PUBLISHER',
    state: 'ACTIVE',
    firstPartyAuthorized: false,
    validFrom: new Date('2026-11-09T00:00:00.000Z'),
    validUntil: new Date('2026-12-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('publisher signing providers', () => {
  const temporaryDirectories: string[] = []
  afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map(path => rm(path, {recursive: true, force: true})))
  })

  it('keeps disposable keys in memory, publisher-scopes identity resolution, and revokes fail-closed', async () => {
    const provider = new DisposableEd25519SigningProvider({allowInsecureTestProvider: true})
    const alpha = identity()
    const publicKey = provider.createIdentity({providerKeyRef: alpha.providerKeyRef})
    const statement = Buffer.from('{"statementType":"modula.publisher-release.v1"}')

    const resolved = await provider.resolveAuthorizedIdentity({publisherId: alpha.publisherId, firstParty: false, identities: [
      alpha,
      identity({identityId: 'psi_00000000-0000-4000-8000-000000000002', publisherId: 'publisher.beta', providerKeyRef: 'test/missing-beta'}),
    ], observedAt: now})
    expect(resolved.identityId).toBe(alpha.identityId)
    const signed = await provider.signPublisherRelease(resolved, statement)
    expect(signed).toMatchObject({algorithm: 'Ed25519', providerKeyVersion: 1})
    expect(await provider.verifyPublisherRelease(resolved, statement, signed.signature)).toBe(true)
    expect(await provider.verifyPublisherRelease(resolved, Buffer.from('tampered'), signed.signature)).toBe(false)
    expect(publicKey.publicKeyPem).toContain('PUBLIC KEY')
    expect(JSON.stringify(publicKey)).not.toContain('PRIVATE KEY')

    await expect(provider.resolveAuthorizedIdentity({publisherId: 'publisher.beta', firstParty: false, identities: [alpha], observedAt: now}))
      .rejects.toMatchObject({code: 'IDENTITY_UNAVAILABLE'})
    await expect(provider.resolveAuthorizedIdentity({publisherId: alpha.publisherId, firstParty: true, identities: [alpha], observedAt: now}))
      .rejects.toMatchObject({code: 'IDENTITY_UNAVAILABLE'})
    await provider.revokeKey(alpha, 'test revocation')
    await expect(provider.signPublisherRelease(alpha, statement)).rejects.toMatchObject({code: 'KEY_UNAVAILABLE'})
    await expect(provider.resolveAuthorizedIdentity({publisherId: alpha.publisherId, firstParty: false, identities: [alpha], observedAt: now}))
      .rejects.toMatchObject({code: 'KEY_UNAVAILABLE'})
  })

  it('uses Vault Transit Ed25519 raw-byte signing and a workload token file', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'modula-signing-provider-'))
    temporaryDirectories.push(directory)
    const tokenFile = join(directory, 'token')
    await writeFile(tokenFile, 'disposable-test-token\n', {mode: 0o600})

    const pair = generateKeyPairSync('ed25519')
    const publicDer = pair.publicKey.export({format: 'der', type: 'spki'})
    const rawPublicKey = publicDer.subarray(publicDer.length - 32).toString('base64')
    const calls: Array<{url: string; method: string; body: Record<string, unknown> | null}> = []
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input)
      const method = init?.method ?? 'GET'
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null
      calls.push({url, method, body})
      expect(new Headers(init?.headers).get('x-vault-token')).toBe('disposable-test-token')
      if (url.endsWith('/keys/publisher-alpha')) {
        return new Response(JSON.stringify({data: {type: 'ed25519', latest_version: 3, keys: {'3': {public_key: rawPublicKey}}}}), {status: 200})
      }
      if (url.endsWith('/sign/publisher-alpha')) {
        const bytes = Buffer.from(String(body?.input), 'base64')
        const signature = sign(null, bytes, pair.privateKey).toString('base64')
        return new Response(JSON.stringify({data: {signature: `vault:v3:${signature}`}}), {status: 200})
      }
      if (url.endsWith('/keys/publisher-alpha/rotate')) return new Response(JSON.stringify({data: {}}), {status: 200})
      return new Response(JSON.stringify({errors: ['not found']}), {status: 404})
    }
    const provider = new VaultTransitEd25519SigningProvider({baseUrl: 'https://vault.test', tokenFile, fetchImpl: fetchImpl as typeof fetch})
    const vaultIdentity = identity({provider: 'VAULT_TRANSIT', providerKeyRef: 'publisher-alpha'})
    const statement = Buffer.from('canonical statement bytes')

    const publicKey = await provider.getPublicKey(vaultIdentity)
    expect(publicKey).toMatchObject({algorithm: 'Ed25519', providerKeyVersion: 3})
    const signed = await provider.signPublisherRelease(vaultIdentity, statement)
    expect(signed.providerKeyVersion).toBe(3)
    expect(await provider.verifyPublisherRelease(vaultIdentity, statement, signed.signature)).toBe(true)
    expect(calls.find(call => call.url.endsWith('/sign/publisher-alpha'))?.body).toEqual({input: statement.toString('base64'), prehashed: false})
    expect(calls.some(call => call.body && 'signature_algorithm' in call.body)).toBe(false)

    const rotated = await provider.rotateKey(vaultIdentity)
    expect(rotated).toMatchObject({providerKeyRef: 'publisher-alpha', providerKeyVersion: 3})
    expect(await provider.revokeKey(vaultIdentity, 'compromised')).toMatchObject({state: 'REVOKED', externalActionRequired: true})
  })

  it('rotates disposable test material without leaving the prior key active', async () => {
    const provider = new DisposableEd25519SigningProvider({allowInsecureTestProvider: true})
    const current = identity()
    const before = provider.createIdentity({providerKeyRef: current.providerKeyRef})
    const rotated = await provider.rotateKey(current)
    expect(rotated.providerKeyRef).not.toBe(current.providerKeyRef)
    expect(rotated.fingerprint).not.toBe(before.fingerprint)
    expect((await provider.getKeyState(current)).state).toBe('SUSPENDED')
  })

  it('refuses non-TLS remote Vault and relative token paths', () => {
    expect(() => new VaultTransitEd25519SigningProvider({baseUrl: 'http://vault.example', tokenFile: '/run/secrets/vault'}))
      .toThrow(SigningProviderError)
    expect(() => new VaultTransitEd25519SigningProvider({baseUrl: 'https://vault.example', tokenFile: 'relative-token'}))
      .toThrow(SigningProviderError)
  })
})
