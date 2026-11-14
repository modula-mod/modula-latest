import {describe, expect, it} from 'vitest'
import {approvalFactsSha256, statementBytes, statementSha256, type PublisherReleaseApprovalFacts, type PublisherReleaseStatement} from '../src/modules/release-signing.js'
import {DisposableEd25519SigningProvider, type PublisherSigningIdentity} from '../src/publisher/signing-provider.js'

/**
 * Non-production compatibility fixture for Vault Notes 2.1.0-rc.4.
 * These are the candidate's immutable release facts. The artifact checksum is
 * the mission-supplied package checksum; no package is published by this test.
 */
const statement: PublisherReleaseStatement = {
  schemaVersion: '1.0.0',
  statementType: 'modula.publisher-release.v1',
  productId: 'digital.modula.vault-notes',
  version: '2.1.0-rc.4',
  publisherId: 'modula',
  sourceRepository: 'modula-mod/modula-vault-notes',
  sourceSha: 'd5f5fd7fe02a1efa0da21946c4e14d71eb4d8069',
  releaseTag: 'vault-notes-v2.1.0-rc.4',
  artifactSha256: '727c718436f97baf9562d3bc0562c24704362a1962c97704c409f1ecdb7b5aca',
  manifestSha256: 'a9287ee9ebae1ea664a1e5be79650dcb4fa7202a50d8976f25f660f8c22ee952',
  productManifestSha256: '65a10729a34040645747e5bf06cfdcf7654a264b75b4ded0f5954292f7de55af',
  frontendSha256: 'aa8c92013dbcf3b407e769ba158e2da7fa5514c6f1bc7339b48df366d97c1182',
  signingKeyId: 'fixture-vault-notes-online-2026-01',
}

describe('Vault Notes 2.1.0-rc.4 online signing compatibility fixture', () => {
  it('constructs and verifies v1 statement bytes with a temporary first-party test key', async () => {
    const provider = new DisposableEd25519SigningProvider({allowInsecureTestProvider: true})
    const identity: PublisherSigningIdentity = {
      identityId: 'psi_00000000-0000-4000-8000-000000000004',
      publisherId: 'modula',
      signingKeyId: statement.signingKeyId,
      provider: 'DISPOSABLE_TEST',
      providerKeyRef: 'test/vault-notes-2.1.0-rc.4',
      purpose: 'MODULA_FIRST_PARTY',
      state: 'ACTIVE',
      firstPartyAuthorized: true,
      validFrom: new Date('2026-11-09T00:00:00.000Z'),
      validUntil: new Date('2026-11-11T00:00:00.000Z'),
    }
    provider.createIdentity({providerKeyRef: identity.providerKeyRef})
    const resolved = await provider.resolveAuthorizedIdentity({publisherId: 'modula', firstParty: true, identities: [identity], observedAt: new Date('2026-11-10T12:00:00.000Z')})
    const canonical = statementBytes(statement)
    const signed = await provider.signPublisherRelease(resolved, canonical)

    expect(statement.statementType).toBe('modula.publisher-release.v1')
    expect(statement.artifactSha256).toBe('727c718436f97baf9562d3bc0562c24704362a1962c97704c409f1ecdb7b5aca')
    expect(statementSha256(statement)).toBe('6995c0114955b13121bd06024dacdb49acee1557d0cd332b08cd7cc4f69a597a')
    const {signingKeyId: _signingKeyId, ...approval} = statement
    expect(approvalFactsSha256({...approval, sourceSha: '0'.repeat(40)} as PublisherReleaseApprovalFacts)).not.toBe(approvalFactsSha256(approval))
    expect(approvalFactsSha256({...approval, manifestSha256: '0'.repeat(64)} as PublisherReleaseApprovalFacts)).not.toBe(approvalFactsSha256(approval))
    expect(await provider.verifyPublisherRelease(resolved, canonical, signed.signature)).toBe(true)
    expect(await provider.verifyPublisherRelease(resolved, Buffer.from(canonical.toString().replace('rc.4', 'rc.5')), signed.signature)).toBe(false)
  })
})
