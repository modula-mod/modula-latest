import Fastify from 'fastify'
import {afterAll, describe, expect, it} from 'vitest'
import {applyBrowserVisibleMediaHeaders} from '../src/app/media-response.js'
import {registerPlugins} from '../src/app/register-plugins.js'
import {loadConfig} from '../src/config/env.js'

describe('Phase 7L-B media response headers', () => {
  const app = Fastify({genReqId: () => ''})

  afterAll(async () => {
    await app.close()
  })

  it('permits same-site browser media without widening CORS origins', async () => {
    await registerPlugins(
      app,
      loadConfig({
        NODE_ENV: 'test',
        MODULA_ENVIRONMENT: 'development',
        MODULA_API_HOST: '127.0.0.1',
        MODULA_API_PORT: '4026',
        MODULA_PUBLIC_API_URL: 'http://127.0.0.1:4026',
        MODULA_DATABASE_URL: 'postgres://modula:modula@127.0.0.1:5432/modula_test',
        MODULA_ALLOWED_ORIGINS: 'https://modula.digital,http://localhost:8081',
        MODULA_RATE_LIMIT_ENABLED: 'false',
      }),
    )
    app.get('/v1/media/example.png', async (_request, reply) => {
      return applyBrowserVisibleMediaHeaders(reply).type('image/png').send(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
    })
    await app.ready()

    const allowed = await app.inject({
      method: 'GET',
      url: '/v1/media/example.png',
      headers: {origin: 'https://modula.digital'},
    })
    expect(allowed.statusCode).toBe(200)
    expect(allowed.headers['access-control-allow-origin']).toBe('https://modula.digital')
    expect(allowed.headers['cache-control']).toBe('private, no-store')
    expect(allowed.headers['content-type']).toContain('image/png')
    expect(allowed.headers['cross-origin-resource-policy']).toBe('same-site')

    const deniedOrigin = await app.inject({
      method: 'GET',
      url: '/v1/media/example.png',
      headers: {origin: 'https://evil.example'},
    })
    expect(deniedOrigin.statusCode).toBe(200)
    expect(deniedOrigin.headers['access-control-allow-origin']).toBeUndefined()
    expect(deniedOrigin.headers['cross-origin-resource-policy']).toBe('same-site')
  })
})
