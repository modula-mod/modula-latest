// Run: node --test tools/api-atlas/lib.test.mjs
import {test} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs'
import {join} from 'node:path'
import {tmpdir} from 'node:os'
import {extractSourceRoutes} from './lib.mjs'

// The Atlas used to read only the handler argument's own text, so auth
// enforced inside a locally-defined wrapper (Moliboo handle(), Gubic
// authed(), AI adminAction()) or a route config (websocket preValidation)
// was labelled anonymous. These fixtures pin the fix, and the
// build-service trap: a method call builds.authenticate() must not resolve
// the local authenticate() helper, or the route would be mislabelled as a
// greenfield session route (it rejects bearer tokens outright).
const FIXTURE = `
export async function registerFixtureRoutes(app: any, sessions: any): Promise<void> {
  const handle = (cap: string, fallback: string, fn: (accountId: string, request: any) => Promise<unknown>) =>
    async (request: any, reply: any) => {
      const auth = requireCapability(request, reply, cap)
      if (!auth) return
      return reply.send(await fn(auth.accountId, request))
    }
  const resolve = async (request: any) => {
    const header = request.headers.authorization
    return header?.startsWith('Bearer ') ? sessions.resolveAccess(header.slice(7).trim()) : null
  }
  const authed = (fallback: string, handler: (accountId: string, request: any) => Promise<unknown>) => async (request: any, reply: any) => {
    const auth = await resolve(request)
    if (!auth) return reply.code(401).send({error: 'UNAUTHENTICATED'})
    return reply.send(await handler(auth.accountId, request))
  }
  const authenticate = async (request: any, reply: any) => {
    const header = request.headers.authorization
    const auth = header?.startsWith('Bearer ') ? await sessions.resolveAccess(header.slice(7).trim()) : null
    if (!auth) reply.code(401).send({error: 'UNAUTHENTICATED'})
    return auth
  }
  const internal = (handler: (serviceId: string, payload: any) => Promise<unknown>) => async (request: any, reply: any) => {
    if (request.headers.authorization) return reply.code(401).send({error: 'RAW_USER_BEARER_REJECTED'})
    const serviceId = String(request.headers['x-modula-service-id'] ?? '')
    const signature = String(request.headers['x-modula-service-signature'] ?? '')
    await builds.authenticate(serviceId, signature, request.body ?? {})
    return reply.send(await handler(serviceId, request.body ?? {}))
  }

  app.get('/v1/moliboo/inventory', handle('social:read', 'Unable to load inventory', (a: string) => items(a)))
  app.post('/v1/moliboo/outfits', handle('profile:update', 'Unable to save outfit', (a: string, r: any) => save(a, r.body ?? {})))
  app.get('/v1/gubic/library', authed('GUBIC library failed', (a: string) => library(a)))
  app.get('/v1/messaging/socket', {
    websocket: true,
    preHandler: async (request: any, reply: any) => {
      const auth = requireCapability(request, reply, 'social:read')
      if (!auth) return reply
    },
  } as any, async (socket: any, request: any) => {})
  app.post('/v1/internal/build-service/claims', internal((serviceId: string, payload: any) => claim(serviceId, payload)))
  app.get('/v1/discover', async (request: any, reply: any) => reply.send(await discover()))
  app.get('/v1/search', async (request: any, reply: any) => reply.send(await search(request.auth?.actorId ?? null)))
}

function requireCapability(request: any, reply: any, cap: string) { return {accountId: 'a'} }
const builds = {authenticate: async (...args: any[]) => {}}
const items = async (a: string) => []
const save = async (a: string, b: any) => ({})
const library = async (a: string) => []
const claim = async (s: string, p: any) => ({})
const discover = async () => []
const search = async (actorId: string | null) => []
`

function routesByKey() {
  const root = mkdtempSync(join(tmpdir(), 'modula-atlas-lib-test-'))
  try {
    const dir = join(root, 'services', 'greenfield-api', 'src', 'app')
    mkdirSync(dir, {recursive: true})
    writeFileSync(join(dir, 'register-fixture-routes.ts'), FIXTURE)
    const routes = extractSourceRoutes(root)
    return new Map(routes.map(route => [`${route.method} ${route.path}`, route]))
  } finally {
    rmSync(root, {recursive: true, force: true})
  }
}

test('wrapper-enforced auth is labelled authenticated, with capabilities', () => {
  const routes = routesByKey()
  const inventory = routes.get('GET /v1/moliboo/inventory')
  assert.ok(inventory, 'moliboo inventory route found')
  assert.equal(inventory.auth.sessionRequired, true)
  assert.equal(inventory.auth.sessionKind, 'legacy or bridged bearer session')
  assert.deepEqual(inventory.auth.capabilities, ['social:read'])
  assert.equal(inventory.auth.anonymousAllowed, false)
  assert.equal(inventory.ownership.accountScoped, true)

  const outfit = routes.get('POST /v1/moliboo/outfits')
  assert.ok(outfit, 'moliboo outfits route found')
  assert.equal(outfit.auth.sessionRequired, true)
  assert.deepEqual(outfit.auth.capabilities, ['profile:update'])

  const library = routes.get('GET /v1/gubic/library')
  assert.ok(library, 'gubic library route found')
  assert.equal(library.auth.sessionRequired, true)
  assert.equal(library.auth.sessionKind, 'greenfield bearer access session')
  assert.equal(library.ownership.accountScoped, true)
})

test('auth in a route config preValidation is labelled, with capability', () => {
  const routes = routesByKey()
  const socket = routes.get('GET /v1/messaging/socket')
  assert.ok(socket, 'messaging socket route found')
  assert.equal(socket.auth.sessionRequired, true)
  assert.equal(socket.auth.sessionKind, 'legacy or bridged bearer session')
  assert.deepEqual(socket.auth.capabilities, ['social:read'])
})

test('a service-signature wrapper keeps its build-service label', () => {
  const routes = routesByKey()
  const claims = routes.get('POST /v1/internal/build-service/claims')
  assert.ok(claims, 'build-service claims route found')
  assert.equal(claims.auth.sessionRequired, false)
  assert.equal(claims.auth.sessionKind, 'build-service id plus request signature')
  assert.equal(claims.auth.serviceAssertionRequired, true)
  assert.equal(claims.auth.anonymousAllowed, false)
})

test('public and optional-session routes are untouched', () => {
  const routes = routesByKey()
  const discover = routes.get('GET /v1/discover')
  assert.ok(discover, 'discover route found')
  assert.equal(discover.auth.sessionRequired, false)
  assert.equal(discover.auth.sessionKind, 'none')

  const search = routes.get('GET /v1/search')
  assert.ok(search, 'search route found')
  assert.equal(search.auth.sessionRequired, false)
  assert.equal(search.auth.optionalSession, true)
})
