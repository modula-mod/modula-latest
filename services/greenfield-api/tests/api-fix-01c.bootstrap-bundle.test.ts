import {readFileSync} from 'node:fs'
import {verify} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {describe, expect, it} from 'vitest'
import {parsePublisherPublicKey, statementBytes, statementSha256, type PublisherReleaseStatement} from '../src/modules/release-signing.js'

const bundle = JSON.parse(readFileSync(fileURLToPath(new URL('../../../ops/trust/api-fix-01c-bootstrap.json', import.meta.url)), 'utf8')) as {
  keyId: string
  publicKeyPem: string
  releases: Array<{releaseId: string; statement: PublisherReleaseStatement; statementSha256: string; signature: {keyId: string; value: string}}>
  legacyUpgrades: Array<{fromVersion: string; toVersion: string}>
}

describe('API-FIX-01C public-only offline signing bundle', () => {
  it('contains independently verifiable signatures for the five active release targets', () => {
    const publicKey = parsePublisherPublicKey(bundle.publicKeyPem)
    expect(publicKey.fingerprint).toBe('sha256:0ec4c94fa346fa3d4b4d1baa01e1132c1209bff1f01f352ef4b9b81385a3be4f')
    expect(bundle.releases).toHaveLength(5)
    for (const release of bundle.releases) {
      expect(release.statement.signingKeyId).toBe(bundle.keyId)
      expect(release.signature.keyId).toBe(bundle.keyId)
      expect(statementSha256(release.statement)).toBe(release.statementSha256)
      expect(verify(null, statementBytes(release.statement), publicKey.key, Buffer.from(release.signature.value, 'base64url'))).toBe(true)
      expect(release.releaseId).toContain(`${release.statement.productId}:${release.statement.version}`)
    }
  })

  it('leaves unverifiable 0.1 and 0.2 unsigned and detects tampering', () => {
    const publicKey = parsePublisherPublicKey(bundle.publicKeyPem)
    expect(bundle.releases.some(release => release.statement.version === '0.1.0' || release.statement.version === '0.2.0')).toBe(false)
    expect(bundle.legacyUpgrades.map(item => item.fromVersion).sort()).toEqual(['0.1.0', '0.2.0'])
    const signed = bundle.releases[0]!
    const tampered = {...signed.statement, artifactSha256: '0'.repeat(64)}
    expect(verify(null, statementBytes(tampered), publicKey.key, Buffer.from(signed.signature.value, 'base64url'))).toBe(false)
  })
})
