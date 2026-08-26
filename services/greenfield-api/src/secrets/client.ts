import type {AppConfig} from '../config/index.js'
import {moduleError, type ModuleDomainErrorCode} from '../modules/module-errors.js'

export type SecretLease = {
  reference: string
  namespace: string
  version: string
  state: 'CURRENT'
  manifestCommit: string
  environment: string
  leaseId: string
  expiresAt: string
  useToken: string
}

export class CredentialBrokerClient {
  constructor(private readonly config: AppConfig) {}

  async lease(input: {
    serviceAssertion: string
    reference: string
    purpose: string
    requestId: string
    traceId: string
  }): Promise<SecretLease> {
    const origin = this.config.secretsServiceUrl
    if (!origin) throw moduleError('CAPABILITY_DISABLED', 'Credential broker is not configured')
    let response: Response
    try {
      response = await fetch(`${origin}/v1/secrets/lease`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-modula-service-assertion': input.serviceAssertion,
          'x-request-id': input.requestId,
          'x-trace-id': input.traceId,
        },
        body: JSON.stringify({reference: input.reference, purpose: input.purpose}),
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.secretsServiceTimeoutMs),
      })
    } catch {
      throw moduleError('CAPABILITY_DISABLED', 'Credential broker is unavailable')
    }
    const raw = await response.text()
    if (Buffer.byteLength(raw) > 131_072) throw moduleError('SERVER_ERROR', 'Credential broker response exceeded the safety limit')
    const envelope = parseEnvelope(raw)
    if (!response.ok) throw moduleError(brokerErrorCode(envelope), brokerErrorMessage(envelope))
    return requireLease(envelope)
  }
}

function parseEnvelope(raw: string): Record<string, unknown> {
  try {
    const value = JSON.parse(raw) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid')
    return value as Record<string, unknown>
  } catch {
    throw moduleError('SERVER_ERROR', 'Credential broker returned an invalid response')
  }
}

function brokerErrorCode(envelope: Record<string, unknown>): ModuleDomainErrorCode {
  const error = objectOrNull(envelope.error)
  const code = error?.code
  if (code === 'UNAUTHENTICATED' || code === 'FORBIDDEN' || code === 'NOT_FOUND' || code === 'CONFLICT' || code === 'RATE_LIMITED') return code
  if (code === 'NOT_READY') return 'CAPABILITY_DISABLED'
  return 'SERVER_ERROR'
}

function brokerErrorMessage(envelope: Record<string, unknown>): string {
  const error = objectOrNull(envelope.error)
  const code = brokerErrorCode(envelope)
  if (code === 'SERVER_ERROR') return 'Credential broker request failed'
  return typeof error?.message === 'string' && error.message.length <= 240 ? error.message : 'Credential broker request failed'
}

function requireLease(envelope: Record<string, unknown>): SecretLease {
  const data = objectOrNull(envelope.data)
  if (!data) throw moduleError('SERVER_ERROR', 'Credential broker returned an invalid lease')
  const lease = {
    reference: required(data.reference),
    namespace: required(data.namespace),
    version: required(data.version),
    state: required(data.state),
    manifestCommit: required(data.manifestCommit),
    environment: required(data.environment),
    leaseId: required(data.leaseId),
    expiresAt: required(data.expiresAt),
    useToken: required(data.useToken),
  }
  if (lease.state !== 'CURRENT' || !lease.reference.startsWith('secret://') || lease.useToken.length < 32) {
    throw moduleError('SERVER_ERROR', 'Credential broker returned an invalid lease')
  }
  return lease as SecretLease
}

function objectOrNull(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function required(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 4096) throw moduleError('SERVER_ERROR', 'Credential broker returned an invalid lease')
  return value
}
