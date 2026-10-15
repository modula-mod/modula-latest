import Fastify from 'fastify'
import {afterEach, describe, expect, it} from 'vitest'
import type {AppConfig} from '../src/config/index.js'
import {requestIdFromHeaders} from '../src/app/create-server.js'
import {registerPlugins} from '../src/app/register-plugins.js'
import {successEnvelope} from '../src/transport/envelope.js'

const apps: Array<ReturnType<typeof Fastify>> = []

afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.close()))
})

async function tracedApp() {
  const app = Fastify({logger: false, genReqId: request => requestIdFromHeaders(request.headers)})
  apps.push(app)
  await registerPlugins(app, {
    allowedOrigins: ['https://modula.digital'],
    rateLimitEnabled: false,
  } as AppConfig)
  app.get('/trace', async request => successEnvelope({requestId: request.id}, request.id))
  return app
}

async function rateLimitedApp() {
  const app = Fastify({logger: false, genReqId: request => requestIdFromHeaders(request.headers)})
  apps.push(app)
  await registerPlugins(app, {
    allowedOrigins: ['https://modula.digital'],
    rateLimitEnabled: true,
  } as AppConfig)
  app.get('/limited', {config: {rateLimit: {max: 1, timeWindow: '1 minute'}}}, async request =>
    successEnvelope({requestId: request.id}, request.id),
  )
  return app
}

describe('GreenField v1 request correlation boundary', () => {
  it('uses a valid standard request ID before request hooks and echoes it', async () => {
    const app = await tracedApp()
    const response = await app.inject({method: 'GET', url: '/trace', headers: {'x-request-id': 'native:install-42'}})

    expect(response.statusCode).toBe(200)
    expect(response.headers['x-request-id']).toBe('native:install-42')
    expect(response.json()).toMatchObject({data: {requestId: 'native:install-42'}, meta: {requestId: 'native:install-42'}})
  })

  it('accepts the Modula compatibility header when the standard header is absent', async () => {
    const app = await tracedApp()
    const response = await app.inject({method: 'GET', url: '/trace', headers: {'x-modula-request-id': 'modula.sync.99'}})

    expect(response.headers['x-request-id']).toBe('modula.sync.99')
    expect(response.json().meta.requestId).toBe('modula.sync.99')
  })

  it('replaces malformed or oversized caller IDs instead of logging or reflecting them', async () => {
    const app = await tracedApp()
    const invalid = `secret with spaces ${'x'.repeat(160)}`
    const response = await app.inject({method: 'GET', url: '/trace', headers: {'x-request-id': invalid}})
    const requestId = response.headers['x-request-id']

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/)
    expect(requestId).not.toContain('secret')
    expect(response.json().meta.requestId).toBe(requestId)
  })

  it('returns frozen 429 semantics and Retry-After when a route limit is exceeded', async () => {
    const app = await rateLimitedApp()
    await app.inject({method: 'GET', url: '/limited'})
    const response = await app.inject({method: 'GET', url: '/limited', headers: {'x-request-id': 'rate-limit-proof'}})

    expect(response.statusCode).toBe(429)
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0)
    expect(response.json()).toMatchObject({
      ok: false,
      error: {code: 'RATE_LIMITED', requestId: 'rate-limit-proof', retryable: true},
      meta: {requestId: 'rate-limit-proof'},
    })
    expect(response.json()).not.toHaveProperty('statusCode')
  })
})
