import {createPrivateKey, sign, type KeyObject} from 'node:crypto'
import http2 from 'node:http2'

export type ApnsEnvironment = 'development' | 'production'

export interface ApnsConfig {
  keyId: string
  teamId: string
  privateKey: KeyObject
  bundleId: string
  defaultEnvironment: ApnsEnvironment
}

/**
 * Reads APNs token-auth settings. Returns null (push disabled, queue keeps
 * accumulating with retries paused) when any required variable is missing.
 * APNS_KEY_P8 may be the PEM text (literal newlines or "\n" escapes) or base64 of it.
 */
export function loadApnsConfig(env: NodeJS.ProcessEnv = process.env): ApnsConfig | null {
  const keyId = env.APNS_KEY_ID?.trim()
  const teamId = env.APNS_TEAM_ID?.trim()
  const rawKey = env.APNS_KEY_P8?.trim()
  if (!keyId || !teamId || !rawKey) return null
  const bundleId = env.APNS_BUNDLE_ID?.trim() || 'digital.modula.app.native'
  const defaultEnvironment: ApnsEnvironment = env.APNS_ENV === 'development' || env.APNS_ENV === 'sandbox' ? 'development' : 'production'
  return {keyId, teamId, bundleId, defaultEnvironment, privateKey: parseP8(rawKey)}
}

export function parseP8(raw: string): KeyObject {
  let pem = raw.replace(/\\n/g, '\n')
  if (!pem.includes('BEGIN PRIVATE KEY')) {
    const decoded = Buffer.from(pem, 'base64').toString('utf8')
    pem = decoded.includes('BEGIN PRIVATE KEY')
      ? decoded
      : `-----BEGIN PRIVATE KEY-----\n${pem.replace(/\s+/g, '')}\n-----END PRIVATE KEY-----\n`
  }
  return createPrivateKey({key: pem, format: 'pem'})
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url')

/** ES256 provider token. Apple accepts tokens up to 60 minutes old; we refresh at 50. */
export function createProviderToken(config: Pick<ApnsConfig, 'keyId' | 'teamId' | 'privateKey'>, nowSeconds = Math.floor(Date.now() / 1000)): string {
  const header = b64url(JSON.stringify({alg: 'ES256', kid: config.keyId}))
  const claims = b64url(JSON.stringify({iss: config.teamId, iat: nowSeconds}))
  const signature = sign('sha256', Buffer.from(`${header}.${claims}`), {key: config.privateKey, dsaEncoding: 'ieee-p1363'})
  return `${header}.${claims}.${b64url(signature)}`
}

export interface ApnsRequest {
  token: string
  environment: ApnsEnvironment
  payload: Record<string, unknown>
  collapseId?: string
  pushType?: 'alert' | 'background'
  expirationSeconds?: number
}

export interface ApnsResponse {
  status: number
  reason?: string
  apnsId?: string
}

export type ApnsOutcome = 'sent' | 'invalid-token' | 'retry' | 'auth-error' | 'rejected'

/** Map an APNs HTTP/2 response to what the queue should do. */
export function classifyApnsResponse(response: ApnsResponse): ApnsOutcome {
  if (response.status === 200) return 'sent'
  if (response.status === 410) return 'invalid-token'
  if (response.status === 400 && (response.reason === 'BadDeviceToken' || response.reason === 'DeviceTokenNotForTopic')) return 'invalid-token'
  if (response.status === 403 && (response.reason === 'ExpiredProviderToken' || response.reason === 'InvalidProviderToken')) return 'auth-error'
  if (response.status === 429 || response.status >= 500 || response.status === 0) return 'retry'
  return 'rejected'
}

export interface PushSender {
  send(request: ApnsRequest): Promise<ApnsResponse>
  close(): void
}

const HOSTS: Record<ApnsEnvironment, string> = {
  production: 'https://api.push.apple.com',
  development: 'https://api.sandbox.push.apple.com',
}

/** HTTP/2 APNs client with one cached session per environment and a cached provider token. */
export class ApnsSender implements PushSender {
  private sessions = new Map<ApnsEnvironment, http2.ClientHttp2Session>()
  private token: {value: string; issuedAt: number} | null = null

  constructor(private readonly config: ApnsConfig, private readonly timeoutMs = 10_000) {}

  invalidateProviderToken(): void {
    this.token = null
  }

  private providerToken(): string {
    const now = Math.floor(Date.now() / 1000)
    if (!this.token || now - this.token.issuedAt > 50 * 60) {
      this.token = {value: createProviderToken(this.config, now), issuedAt: now}
    }
    return this.token.value
  }

  private session(environment: ApnsEnvironment): http2.ClientHttp2Session {
    const existing = this.sessions.get(environment)
    if (existing && !existing.closed && !existing.destroyed) return existing
    const session = http2.connect(HOSTS[environment])
    session.on('error', () => this.sessions.delete(environment))
    session.on('close', () => this.sessions.delete(environment))
    session.unref()
    this.sessions.set(environment, session)
    return session
  }

  send(request: ApnsRequest): Promise<ApnsResponse> {
    return new Promise(resolve => {
      let settled = false
      const done = (response: ApnsResponse) => {
        if (settled) return
        settled = true
        resolve(response)
      }
      try {
        const headers: http2.OutgoingHttpHeaders = {
          ':method': 'POST',
          ':path': `/3/device/${request.token}`,
          authorization: `bearer ${this.providerToken()}`,
          'apns-topic': this.config.bundleId,
          'apns-push-type': request.pushType ?? 'alert',
          'apns-priority': request.pushType === 'background' ? '5' : '10',
          'apns-expiration': String(Math.floor(Date.now() / 1000) + (request.expirationSeconds ?? 86_400)),
          'content-type': 'application/json',
        }
        if (request.collapseId) headers['apns-collapse-id'] = request.collapseId.slice(0, 64)
        const stream = this.session(request.environment).request(headers)
        let status = 0
        let apnsId: string | undefined
        let body = ''
        stream.setTimeout(this.timeoutMs, () => {
          stream.close(http2.constants.NGHTTP2_CANCEL)
          done({status: 0, reason: 'Timeout'})
        })
        stream.on('response', responseHeaders => {
          status = Number(responseHeaders[':status'] ?? 0)
          apnsId = typeof responseHeaders['apns-id'] === 'string' ? responseHeaders['apns-id'] : undefined
        })
        stream.setEncoding('utf8')
        stream.on('data', chunk => { body += chunk })
        stream.on('end', () => {
          let reason: string | undefined
          if (body) {
            try { reason = JSON.parse(body).reason } catch { reason = body.slice(0, 200) }
          }
          done({status, reason, apnsId})
        })
        stream.on('error', error => done({status: 0, reason: error.message}))
        stream.end(JSON.stringify(request.payload))
      } catch (error) {
        done({status: 0, reason: error instanceof Error ? error.message : String(error)})
      }
    })
  }

  close(): void {
    for (const session of this.sessions.values()) session.close()
    this.sessions.clear()
  }
}
