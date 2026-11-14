import {createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, type KeyObject} from 'node:crypto'
import {readFile} from 'node:fs/promises'

export type PublisherSigningProviderKind = 'VAULT_TRANSIT' | 'DISPOSABLE_TEST'
export type PublisherSigningPurpose = 'PUBLISHER' | 'MODULA_FIRST_PARTY'
export type PublisherSigningIdentityState = 'ACTIVE' | 'SUSPENDED' | 'REVOKED'

export type PublisherSigningIdentity = {
  identityId: string
  publisherId: string
  signingKeyId: string
  provider: PublisherSigningProviderKind
  providerKeyRef: string
  purpose: PublisherSigningPurpose
  state: PublisherSigningIdentityState
  firstPartyAuthorized: boolean
  validFrom: Date
  validUntil: Date
}

export type PublisherSigningPublicKey = {
  algorithm: 'Ed25519'
  publicKeyPem: string
  fingerprint: string
  providerKeyVersion: number | null
}

export type PublisherSigningResult = {
  algorithm: 'Ed25519'
  signature: string
  providerKeyVersion: number | null
}

export type PublisherSigningProviderKeyState = {
  state: PublisherSigningIdentityState
  providerKeyVersion: number | null
  detail: string
}

export type PublisherSigningRotation = PublisherSigningPublicKey & {providerKeyRef: string}
export type PublisherSigningRevocation = {state: 'REVOKED'; externalActionRequired: boolean; detail: string}

/**
 * Provider boundary for online publisher release signing. Implementations only
 * sign bytes supplied by the release-job runner; no HTTP route exposes this
 * interface and callers never provide a provider key reference or key ID.
 */
export interface PublisherSigningProvider {
  readonly kind: PublisherSigningProviderKind
  resolveAuthorizedIdentity(input: {
    publisherId: string
    firstParty: boolean
    identities: readonly PublisherSigningIdentity[]
    observedAt: Date
  }): Promise<PublisherSigningIdentity>
  getPublicKey(identity: PublisherSigningIdentity): Promise<PublisherSigningPublicKey>
  signPublisherRelease(identity: PublisherSigningIdentity, canonicalStatement: Buffer): Promise<PublisherSigningResult>
  verifyPublisherRelease(identity: PublisherSigningIdentity, canonicalStatement: Buffer, signature: string): Promise<boolean>
  getKeyState(identity: PublisherSigningIdentity): Promise<PublisherSigningProviderKeyState>
  rotateKey(identity: PublisherSigningIdentity): Promise<PublisherSigningRotation>
  revokeKey(identity: PublisherSigningIdentity, reason: string): Promise<PublisherSigningRevocation>
}

export class SigningProviderError extends Error {
  constructor(readonly code: 'NOT_CONFIGURED' | 'IDENTITY_UNAVAILABLE' | 'KEY_UNAVAILABLE' | 'PROVIDER_FAILURE', message: string) {
    super(message)
    this.name = 'SigningProviderError'
  }
}

abstract class BasePublisherSigningProvider implements PublisherSigningProvider {
  abstract readonly kind: PublisherSigningProviderKind
  abstract getPublicKey(identity: PublisherSigningIdentity): Promise<PublisherSigningPublicKey>
  abstract signPublisherRelease(identity: PublisherSigningIdentity, canonicalStatement: Buffer): Promise<PublisherSigningResult>
  abstract getKeyState(identity: PublisherSigningIdentity): Promise<PublisherSigningProviderKeyState>
  abstract rotateKey(identity: PublisherSigningIdentity): Promise<PublisherSigningRotation>
  abstract revokeKey(identity: PublisherSigningIdentity, reason: string): Promise<PublisherSigningRevocation>

  async resolveAuthorizedIdentity(input: {publisherId: string; firstParty: boolean; identities: readonly PublisherSigningIdentity[]; observedAt: Date}) {
    const candidates = input.identities.filter(identity =>
      identity.provider === this.kind
      && identity.publisherId === input.publisherId
      && identity.state === 'ACTIVE'
      && identity.validFrom <= input.observedAt
      && identity.validUntil > input.observedAt
      && (input.firstParty
        ? identity.purpose === 'MODULA_FIRST_PARTY' && identity.firstPartyAuthorized
        : identity.purpose === 'PUBLISHER'),
    )
    if (candidates.length !== 1) {
      throw new SigningProviderError('IDENTITY_UNAVAILABLE', candidates.length ? 'Signing identity selection is ambiguous' : 'No authorized online signing identity is available')
    }
    const state = await this.getKeyState(candidates[0]!)
    if (state.state !== 'ACTIVE') throw new SigningProviderError('KEY_UNAVAILABLE', `Signing provider key is ${state.state.toLowerCase()}`)
    return candidates[0]!
  }

  async verifyPublisherRelease(identity: PublisherSigningIdentity, canonicalStatement: Buffer, signature: string): Promise<boolean> {
    try {
      const key = await this.getPublicKey(identity)
      return verify(null, canonicalStatement, createPublicKey(key.publicKeyPem), Buffer.from(signature, 'base64url'))
    } catch {
      return false
    }
  }
}

type DisposableKey = {privateKey: KeyObject; publicKey: PublisherSigningPublicKey; state: PublisherSigningIdentityState}

/** In-memory Ed25519 provider. The explicit constructor guard prevents accidental production use. */
export class DisposableEd25519SigningProvider extends BasePublisherSigningProvider {
  readonly kind = 'DISPOSABLE_TEST' as const
  private readonly keys = new Map<string, DisposableKey>()
  private signingFailure: string | null = null

  constructor(options: {allowInsecureTestProvider: true}) {
    super()
    if (options.allowInsecureTestProvider !== true) throw new SigningProviderError('NOT_CONFIGURED', 'Disposable signing requires an explicit test-only opt-in')
  }

  createIdentity(input: {providerKeyRef: string; privateKeyPem?: string}): PublisherSigningPublicKey {
    if (!/^[A-Za-z0-9._:/-]{3,240}$/.test(input.providerKeyRef)) throw new SigningProviderError('KEY_UNAVAILABLE', 'Disposable provider key reference is malformed')
    if (this.keys.has(input.providerKeyRef)) throw new SigningProviderError('KEY_UNAVAILABLE', 'Disposable provider key reference already exists')
    const pair = input.privateKeyPem
      ? {privateKey: createPrivateKey(input.privateKeyPem), publicKey: createPublicKey(input.privateKeyPem)}
      : generateKeyPairSync('ed25519')
    if (pair.privateKey.asymmetricKeyType !== 'ed25519') throw new SigningProviderError('KEY_UNAVAILABLE', 'Disposable provider requires an Ed25519 key')
    const publicKey = publicKeyDetails(pair.publicKey, 1)
    this.keys.set(input.providerKeyRef, {privateKey: pair.privateKey, publicKey, state: 'ACTIVE'})
    return publicKey
  }

  async getPublicKey(identity: PublisherSigningIdentity) {
    return this.requireKey(identity).publicKey
  }

  async signPublisherRelease(identity: PublisherSigningIdentity, canonicalStatement: Buffer): Promise<PublisherSigningResult> {
    if (this.signingFailure) throw new SigningProviderError('PROVIDER_FAILURE', this.signingFailure)
    const key = this.requireKey(identity)
    if (key.state !== 'ACTIVE') throw new SigningProviderError('KEY_UNAVAILABLE', `Disposable signing key is ${key.state.toLowerCase()}`)
    return {algorithm: 'Ed25519', signature: sign(null, canonicalStatement, key.privateKey).toString('base64url'), providerKeyVersion: key.publicKey.providerKeyVersion}
  }

  /** Test-only fault injection; no production provider exposes this control. */
  simulateSigningFailure(message: string | null): void {
    this.signingFailure = message
  }

  async getKeyState(identity: PublisherSigningIdentity): Promise<PublisherSigningProviderKeyState> {
    const key = this.requireKey(identity)
    return {state: key.state, providerKeyVersion: key.publicKey.providerKeyVersion, detail: 'Disposable in-memory test key'}
  }

  async rotateKey(identity: PublisherSigningIdentity): Promise<PublisherSigningRotation> {
    const current = this.requireKey(identity)
    current.state = 'SUSPENDED'
    const providerKeyRef = `${identity.providerKeyRef}:v${Date.now()}`
    const publicKey = this.createIdentity({providerKeyRef})
    return {...publicKey, providerKeyRef}
  }

  async revokeKey(identity: PublisherSigningIdentity, _reason: string): Promise<PublisherSigningRevocation> {
    this.requireKey(identity).state = 'REVOKED'
    return {state: 'REVOKED', externalActionRequired: false, detail: 'Disposable key revoked and retained only until this test process exits'}
  }

  private requireKey(identity: PublisherSigningIdentity): DisposableKey {
    if (identity.provider !== this.kind) throw new SigningProviderError('KEY_UNAVAILABLE', 'Signing identity belongs to a different provider')
    const key = this.keys.get(identity.providerKeyRef)
    if (!key) throw new SigningProviderError('KEY_UNAVAILABLE', 'Disposable signing key is unavailable')
    return key
  }
}

export class VaultTransitEd25519SigningProvider extends BasePublisherSigningProvider {
  readonly kind = 'VAULT_TRANSIT' as const
  private readonly baseUrl: string
  private readonly mount: string

  constructor(private readonly options: {
    baseUrl: string
    tokenFile: string
    mount?: string
    namespace?: string | null
    fetchImpl?: typeof fetch
  }) {
    super()
    const url = new URL(options.baseUrl)
    if (url.protocol !== 'https:' && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
      throw new SigningProviderError('NOT_CONFIGURED', 'Vault signing provider requires HTTPS')
    }
    if (!options.tokenFile.startsWith('/')) throw new SigningProviderError('NOT_CONFIGURED', 'Vault token must be supplied through an absolute workload token file')
    this.baseUrl = url.toString().replace(/\/$/, '')
    this.mount = (options.mount ?? 'transit').replace(/^\/+|\/+$/g, '')
  }

  async getPublicKey(identity: PublisherSigningIdentity): Promise<PublisherSigningPublicKey> {
    const data = await this.vault(`/${this.mount}/keys/${encodeURIComponent(identity.providerKeyRef)}`, {method: 'GET'}) as any
    if (String(data?.type ?? '') !== 'ed25519') throw new SigningProviderError('KEY_UNAVAILABLE', 'Vault Transit key is not Ed25519')
    const version = Number(data?.latest_version)
    const encoded = data?.keys?.[String(version)]?.public_key
    if (!Number.isSafeInteger(version) || version < 1 || typeof encoded !== 'string') throw new SigningProviderError('KEY_UNAVAILABLE', 'Vault Transit public key metadata is incomplete')
    const raw = Buffer.from(encoded, 'base64')
    if (raw.length !== 32) throw new SigningProviderError('KEY_UNAVAILABLE', 'Vault Transit Ed25519 public key length is invalid')
    const der = Buffer.concat([Buffer.from('302a300506032b6570032100', 'hex'), raw])
    return publicKeyDetails(createPublicKey({key: der, format: 'der', type: 'spki'}), version)
  }

  async signPublisherRelease(identity: PublisherSigningIdentity, canonicalStatement: Buffer): Promise<PublisherSigningResult> {
    const data = await this.vault(`/${this.mount}/sign/${encodeURIComponent(identity.providerKeyRef)}`, {
      method: 'POST',
      // Vault's signature_algorithm field is RSA-only. For Ed25519, raw
      // canonical statement bytes are base64 encoded and prehashed remains
      // false so the result is standard Ed25519 (not Ed25519ph).
      body: JSON.stringify({input: canonicalStatement.toString('base64'), prehashed: false}),
    }) as any
    const match = /^vault:v(\d+):([A-Za-z0-9+/=]+)$/.exec(String(data?.signature ?? ''))
    if (!match) throw new SigningProviderError('PROVIDER_FAILURE', 'Vault Transit returned a malformed Ed25519 signature')
    const bytes = Buffer.from(match[2]!, 'base64')
    if (bytes.length !== 64) throw new SigningProviderError('PROVIDER_FAILURE', 'Vault Transit returned an invalid Ed25519 signature length')
    return {algorithm: 'Ed25519', signature: bytes.toString('base64url'), providerKeyVersion: Number(match[1])}
  }

  async getKeyState(identity: PublisherSigningIdentity): Promise<PublisherSigningProviderKeyState> {
    try {
      const key = await this.getPublicKey(identity)
      return {state: 'ACTIVE', providerKeyVersion: key.providerKeyVersion, detail: 'Vault Transit key is available'}
    } catch (error) {
      if (error instanceof SigningProviderError && error.code === 'KEY_UNAVAILABLE') return {state: 'SUSPENDED', providerKeyVersion: null, detail: error.message}
      throw error
    }
  }

  async rotateKey(identity: PublisherSigningIdentity): Promise<PublisherSigningRotation> {
    await this.vault(`/${this.mount}/keys/${encodeURIComponent(identity.providerKeyRef)}/rotate`, {method: 'POST', body: '{}'})
    return {...await this.getPublicKey(identity), providerKeyRef: identity.providerKeyRef}
  }

  async revokeKey(_identity: PublisherSigningIdentity, _reason: string): Promise<PublisherSigningRevocation> {
    // Vault Transit has no safe per-key "disable signing" operation. Registry
    // revocation is immediately fail-closed; the runbook separately removes the
    // runner's Vault policy capability for the key path.
    return {state: 'REVOKED', externalActionRequired: true, detail: 'Registry revocation is immediate; remove the Vault signing policy binding for this key'}
  }

  private async vault(path: string, init: RequestInit): Promise<unknown> {
    let token: string
    try { token = (await readFile(this.options.tokenFile, 'utf8')).trim() } catch { throw new SigningProviderError('NOT_CONFIGURED', 'Vault workload token file is unavailable') }
    if (!token) throw new SigningProviderError('NOT_CONFIGURED', 'Vault workload token file is empty')
    const headers: Record<string, string> = {'content-type': 'application/json', 'x-vault-token': token}
    if (this.options.namespace) headers['x-vault-namespace'] = this.options.namespace
    let response: Response
    try { response = await (this.options.fetchImpl ?? fetch)(`${this.baseUrl}/v1${path}`, {...init, headers}) }
    catch { throw new SigningProviderError('PROVIDER_FAILURE', 'Vault signing service is unavailable') }
    if (!response.ok) throw new SigningProviderError(response.status === 404 || response.status === 403 ? 'KEY_UNAVAILABLE' : 'PROVIDER_FAILURE', `Vault signing service refused the operation (${response.status})`)
    const body = await response.json() as {data?: unknown}
    return body.data ?? {}
  }
}

export function vaultTransitProviderFromEnvironment(env: NodeJS.ProcessEnv = process.env): VaultTransitEd25519SigningProvider | null {
  if (env.MODULA_ONLINE_SIGNING_ENABLED !== 'true' || env.MODULA_SIGNING_PROVIDER !== 'vault-transit') return null
  const baseUrl = env.MODULA_SIGNING_VAULT_ADDR?.trim()
  const tokenFile = env.MODULA_SIGNING_VAULT_TOKEN_FILE?.trim()
  if (!baseUrl || !tokenFile) throw new SigningProviderError('NOT_CONFIGURED', 'Vault signing is enabled but address or workload token file is missing')
  return new VaultTransitEd25519SigningProvider({
    baseUrl,
    tokenFile,
    mount: env.MODULA_SIGNING_VAULT_MOUNT?.trim() || 'transit',
    namespace: env.MODULA_SIGNING_VAULT_NAMESPACE?.trim() || null,
  })
}

function publicKeyDetails(key: KeyObject, providerKeyVersion: number | null): PublisherSigningPublicKey {
  if (key.asymmetricKeyType !== 'ed25519') throw new SigningProviderError('KEY_UNAVAILABLE', 'Signing provider key is not Ed25519')
  const der = key.export({format: 'der', type: 'spki'})
  return {
    algorithm: 'Ed25519',
    publicKeyPem: key.export({format: 'pem', type: 'spki'}).toString(),
    fingerprint: `sha256:${createHash('sha256').update(der).digest('hex')}`,
    providerKeyVersion,
  }
}
