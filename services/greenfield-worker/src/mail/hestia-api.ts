import {readFileSync} from 'node:fs'
import {request as httpsRequest} from 'node:https'
import type {WorkerConfig} from '../config.js'
import type {
  MailProviderAdapter,
  ProviderForwardInput,
  ProviderOperationResult,
  ProviderProvisionInput,
} from './provisioner.js'

// Hestia REST API mail provisioning adapter (MODULA_MAIL_PROVISIONER_MODE=hestia-api).
//
// Talks to the Hestia panel API over HTTPS (node:https, no new dependencies):
// one form-encoded POST per Hestia command (access_key, secret_key, cmd, arg1...).
// The CLI adapter (mode `hestia`) is untouched; rollback is a config flip.
//
// TLS is fail-closed: verification is always on (`rejectUnauthorized: true`,
// never false). When MODULA_MAIL_HESTIA_API_CA_PATH is set, the PEM at that
// path is the trust anchor for the panel certificate; otherwise Node's
// default trust store applies and a self-signed panel cert fails closed.
//
// No secret material (access key, API secret, mailbox password) is ever
// logged, and error messages are redacted before they leave this module:
// the adapter's own messages contain only the command name, the Hestia exit
// code and the HTTP status — never arguments or response bodies.

export const HESTIA_EXIT_EXISTS = 4 // E_EXISTS
export const HESTIA_EXIT_NOT_EXIST = 10 // E_NOTEXIST

export type HestiaApiResponse = {
  exitCode: number
  httpStatus: number
  body: string
}

/** Injectable HTTP call: one Hestia command → its exit code + raw body. */
export type HestiaApiTransport = (cmd: string, args: string[]) => Promise<HestiaApiResponse>

export class HestiaApiProviderError extends Error {
  constructor(
    readonly command: string,
    readonly exitCode: number | null,
    readonly httpStatus: number | null,
    message?: string,
  ) {
    super(
      message ??
        `Hestia API command ${command} failed` +
          (exitCode !== null ? ` (exit ${exitCode})` : '') +
          (httpStatus !== null ? ` (HTTP ${httpStatus})` : ''),
    )
    this.name = 'HestiaApiProviderError'
  }
}

/** Quota in bytes → the MiB integer Hestia's v-add-mail-account expects (min 1). */
export function quotaBytesToMiB(quotaBytes: number): number {
  return Math.max(1, Math.round(quotaBytes / 1024 / 1024))
}

/** Build the form-encoded API body. Field order is access_key, secret_key, cmd, arg1... */
export function buildHestiaApiFormBody(accessKey: string, secretKey: string, cmd: string, args: string[]): URLSearchParams {
  const body = new URLSearchParams()
  body.set('access_key', accessKey)
  body.set('secret_key', secretKey)
  body.set('cmd', cmd)
  args.forEach((arg, index) => {
    body.set(`arg${index + 1}`, arg)
  })
  return body
}

/**
 * The real transport: a single node:https POST to the panel API.
 * Throws at construction on a non-https URL or an unreadable CA file —
 * the worker must fail fast at start, not on the first provision attempt.
 */
export function createHestiaApiHttpsTransport(options: {
  url: string
  accessKey: string
  secretKey: string
  caPath?: string
  timeoutMs: number
}): HestiaApiTransport {
  const baseUrl = new URL(options.url)
  if (baseUrl.protocol !== 'https:') {
    throw new Error('MODULA_MAIL_HESTIA_API_URL must use https')
  }
  const ca = options.caPath ? readFileSync(options.caPath) : undefined
  const encoded = (cmd: string, args: string[]): string =>
    buildHestiaApiFormBody(options.accessKey, options.secretKey, cmd, args).toString()

  return (cmd, args) =>
    new Promise<HestiaApiResponse>((resolve, reject) => {
      const payload = encoded(cmd, args)
      const req = httpsRequest(
        baseUrl,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/x-www-form-urlencoded',
            'content-length': Buffer.byteLength(payload),
          },
          timeout: options.timeoutMs,
          ca,
          // Fail-closed: never false. The panel cert must verify (directly,
          // or via the CA file) or the request fails.
          rejectUnauthorized: true,
        },
        res => {
          const chunks: Buffer[] = []
          res.on('data', chunk => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          })
          res.on('end', () => {
            const header = res.headers['hestia-exit-code']
            const headerValue = Array.isArray(header) ? header[0] : header
            const parsed = headerValue === undefined ? Number.NaN : Number.parseInt(headerValue, 10)
            // The panel always sets Hestia-Exit-Code; fall back to the HTTP
            // status only if the header is absent.
            const exitCode = Number.isInteger(parsed) ? parsed : res.statusCode === 200 ? 0 : -1
            resolve({exitCode, httpStatus: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8')})
          })
        },
      )
      req.on('timeout', () => {
        req.destroy(new Error(`Hestia API request timed out after ${options.timeoutMs}ms`))
      })
      req.on('error', reject)
      req.end(payload)
    })
}

export class HestiaApiMailProviderAdapter implements MailProviderAdapter {
  readonly providerId = 'hestia-api'
  private readonly transport: HestiaApiTransport
  private readonly knownSecrets: string[]

  constructor(
    private readonly config: WorkerConfig,
    transport?: HestiaApiTransport,
  ) {
    this.knownSecrets = [config.mailHestiaApiKey, config.mailHestiaApiSecret].filter(
      (value): value is string => typeof value === 'string' && value.length > 0,
    )
    this.transport =
      transport ??
      createHestiaApiHttpsTransport({
        url: this.apiUrl(),
        accessKey: this.apiKey(),
        secretKey: this.apiSecret(),
        caPath: config.mailHestiaApiCaPath,
        timeoutMs: config.mailProvisionerCommandTimeoutMs,
      })
  }

  async health(): Promise<{status: 'healthy' | 'disabled'; provider: string}> {
    const response = await this.call('v-list-mail-domain', [this.user(), this.config.mailDomain, 'json'])
    this.requireSuccess(response, 'v-list-mail-domain')
    return {status: 'healthy' as const, provider: this.providerId}
  }

  async availability(input: {localPart: string; domain: string; address: string}): Promise<{
    available: boolean
    reason: string | null
  }> {
    const response = await this.call('v-list-mail-account', [this.user(), input.domain, input.localPart, 'json'])
    if (response.exitCode === 0) return {available: false, reason: 'provider_exists'}
    if (response.exitCode === HESTIA_EXIT_NOT_EXIST) return {available: true, reason: null}
    throw this.providerError(response, 'v-list-mail-account')
  }

  async provision(input: ProviderProvisionInput): Promise<ProviderOperationResult> {
    // List-first, then create-or-adopt (§6.2 of the mail-provisioning design):
    // a retry after a half-created account (or after a successful provider
    // call but a failed DB transaction) must adopt the existing account and
    // rotate its password to the new secret — never fail, and never leave
    // the stored credential disagreeing with the provider password.
    const existing = await this.call('v-list-mail-account', [this.user(), input.domain, input.localPart, 'json'])
    if (existing.exitCode === 0) return this.rotatePassword(input)
    if (existing.exitCode !== HESTIA_EXIT_NOT_EXIST) {
      throw this.providerError(existing, 'v-list-mail-account')
    }
    const quotaMiB = quotaBytesToMiB(this.config.mailDefaultQuotaBytes)
    const added = await this.call('v-add-mail-account', [
      this.user(),
      input.domain,
      input.localPart,
      input.secret,
      String(quotaMiB),
    ])
    if (added.exitCode === 0) {
      return {
        providerReference: this.reference(input),
        quotaBytes: quotaMiB * 1024 * 1024,
        storageUsedBytes: 0,
      }
    }
    // Race between the list and the add: fall through to rotate, not failure.
    if (added.exitCode === HESTIA_EXIT_EXISTS) return this.rotatePassword(input)
    throw this.providerError(added, 'v-add-mail-account')
  }

  async adopt(input: {
    localPart: string
    domain: string
    address: string
    providerReference: string
  }): Promise<ProviderOperationResult> {
    const response = await this.call('v-list-mail-account', [this.user(), input.domain, input.localPart, 'json'])
    this.requireSuccess(response, 'v-list-mail-account')
    return {providerReference: input.providerReference}
  }

  async suspend(input: {localPart: string; domain: string; address: string}): Promise<ProviderOperationResult> {
    const response = await this.call('v-suspend-mail-account', [this.user(), input.domain, input.localPart])
    this.requireSuccess(response, 'v-suspend-mail-account')
    return {providerReference: this.reference(input)}
  }

  async resume(input: {localPart: string; domain: string; address: string}): Promise<ProviderOperationResult> {
    const response = await this.call('v-unsuspend-mail-account', [this.user(), input.domain, input.localPart])
    this.requireSuccess(response, 'v-unsuspend-mail-account')
    return {providerReference: this.reference(input)}
  }

  async forward(input: ProviderForwardInput): Promise<ProviderOperationResult> {
    if (input.enabled && input.destination) {
      const response = await this.call('v-add-mail-account-forward', [
        this.user(),
        input.domain,
        input.localPart,
        input.destination,
      ])
      this.requireSuccess(response, 'v-add-mail-account-forward')
    } else {
      // Deleting a forward that was never set is tolerated, as in the CLI adapter.
      await this.call('v-delete-mail-account-forward', [this.user(), input.domain, input.localPart])
    }
    return {providerReference: this.reference(input)}
  }

  async release(input: {localPart: string; domain: string; address: string}): Promise<ProviderOperationResult> {
    const response = await this.call('v-delete-mail-account', [this.user(), input.domain, input.localPart])
    this.requireSuccess(response, 'v-delete-mail-account')
    return {providerReference: `${this.reference(input)}:released`}
  }

  /** Adopt an already-existing account: rotate its password to the new secret. */
  private async rotatePassword(input: ProviderProvisionInput): Promise<ProviderOperationResult> {
    const response = await this.call('v-change-mail-account-password', [
      this.user(),
      input.domain,
      input.localPart,
      input.secret,
    ])
    this.requireSuccess(response, 'v-change-mail-account-password')
    return {providerReference: this.reference(input), storageUsedBytes: 0}
  }

  private reference(input: {domain: string; localPart: string}): string {
    return `hestia:${this.user()}:${input.domain}:${input.localPart}`
  }

  private user(): string {
    if (!this.config.mailHestiaUser) throw new Error('MODULA_MAIL_HESTIA_USER is required for Hestia provisioning')
    return this.config.mailHestiaUser
  }

  private apiUrl(): string {
    if (!this.config.mailHestiaApiUrl) throw new Error('MODULA_MAIL_HESTIA_API_URL is required for Hestia API provisioning')
    return this.config.mailHestiaApiUrl
  }

  private apiKey(): string {
    if (!this.config.mailHestiaApiKey) {
      throw new Error('MODULA_MAIL_HESTIA_API_KEY is required when MODULA_MAIL_PROVISIONER_MODE=hestia-api')
    }
    return this.config.mailHestiaApiKey
  }

  private apiSecret(): string {
    if (!this.config.mailHestiaApiSecret) {
      throw new Error('MODULA_MAIL_HESTIA_API_SECRET is required when MODULA_MAIL_PROVISIONER_MODE=hestia-api')
    }
    return this.config.mailHestiaApiSecret
  }

  private async call(cmd: string, args: string[]): Promise<HestiaApiResponse> {
    try {
      return await this.transport(cmd, args)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new HestiaApiProviderError(
        cmd,
        null,
        null,
        `Hestia API transport failed for ${cmd}: ${this.redact(message, args)}`,
      )
    }
  }

  private requireSuccess(response: HestiaApiResponse, cmd: string): void {
    if (response.exitCode !== 0) throw this.providerError(response, cmd)
  }

  /** Provider errors carry only the command, exit code and HTTP status — never args or bodies. */
  private providerError(response: HestiaApiResponse, cmd: string): HestiaApiProviderError {
    return new HestiaApiProviderError(cmd, response.exitCode, response.httpStatus)
  }

  private redact(message: string, callSecrets: string[]): string {
    let redacted = message
    for (const secret of [...this.knownSecrets, ...callSecrets]) {
      if (secret.length >= 8) redacted = redacted.split(secret).join('[redacted]')
    }
    return redacted.replace(/[A-Za-z0-9_-]{16,}/g, '[redacted]')
  }
}
