import {readFileSync} from 'node:fs'
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, it} from 'vitest'
import {IntelligenceError} from '@modula/intelligence-contracts'
import {InMemoryMissionRuntimeStore} from '@modula/mar-runtime'
import {createCancelRuntime, sessionPrincipal} from '../src/intelligence/mission-cancel.js'

const NOW = '2026-11-07T21:00:00.000Z'
const OWNER = 'account-owner'
const OBJECTIVE = 'List widgets from the registered test module'

function mission(overrides: Record<string, unknown> = {}) {
  return {
    id: 'mission-cancel-1',
    userId: OWNER,
    objective: OBJECTIVE,
    status: 'planning' as const,
    correlationId: 'corr-http-cancel-001',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

describe('POST /v1/intelligence/missions/:missionId/cancel binding', () => {
  it('registers the thin cancel route and delegates to MissionRuntime.cancel', () => {
    const routes = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/intelligence/routes.ts'), 'utf8')
    expect(routes).toContain("app.post('/v1/intelligence/missions/:missionId/cancel'")
    expect(routes).toContain('cancelRuntime.cancel(sessionPrincipal(auth.accountId)')
    expect(routes).toContain('createGreenfieldCancelRuntime(db)')
    expect(routes).not.toMatch(/service\.cancel|intelligence\.cancel/)
    expect(routes).not.toMatch(/vault-notes|digital\.modula\.vault-notes|RECENT_VAULT_NOTES/i)
  })

  it('builds a verified principal from the GreenField session account', () => {
    const principal = sessionPrincipal(OWNER)
    expect(principal.accountId).toBe(OWNER)
    expect(principal.assurance).toEqual({
      kind: 'verified',
      method: 'greenfield-session',
      verifiedAt: principal.assurance.verifiedAt,
    })
    expect(Number.isFinite(Date.parse(principal.assurance.verifiedAt))).toBe(true)
  })

  it('cancels an owned non-terminal mission through MissionRuntime.cancel', async () => {
    const store = new InMemoryMissionRuntimeStore()
    await store.insertMission(mission())
    const runtime = createCancelRuntime(store)
    const cancelled = await runtime.cancel(sessionPrincipal(OWNER), 'mission-cancel-1')
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.completedAt).toBeTruthy()
    const events = await store.listEvents('mission-cancel-1')
    expect(events.some(event => event.type === 'mission.cancelled')).toBe(true)
  })

  it('treats already-cancelled as idempotent success', async () => {
    const store = new InMemoryMissionRuntimeStore()
    await store.insertMission(mission({status: 'cancelled', completedAt: NOW}))
    const runtime = createCancelRuntime(store)
    const cancelled = await runtime.cancel(sessionPrincipal(OWNER), 'mission-cancel-1')
    expect(cancelled.status).toBe('cancelled')
    expect(await store.listEvents('mission-cancel-1')).toEqual([])
  })

  it('rejects other terminal states with INVALID_MISSION_STATE', async () => {
    const store = new InMemoryMissionRuntimeStore()
    await store.insertMission(mission({id: 'mission-completed', status: 'completed', completedAt: NOW, correlationId: 'corr-http-cancel-002'}))
    const runtime = createCancelRuntime(store)
    await expect(runtime.cancel(sessionPrincipal(OWNER), 'mission-completed')).rejects.toMatchObject({
      name: IntelligenceError.name,
      code: 'INVALID_MISSION_STATE',
    })
  })

  it('rejects another account with MISSION_ACCESS_DENIED', async () => {
    const store = new InMemoryMissionRuntimeStore()
    await store.insertMission(mission())
    const runtime = createCancelRuntime(store)
    await expect(runtime.cancel(sessionPrincipal('account-other'), 'mission-cancel-1')).rejects.toMatchObject({
      code: 'MISSION_ACCESS_DENIED',
    })
  })

  it('rejects an unknown mission with MISSION_NOT_FOUND', async () => {
    const runtime = createCancelRuntime(new InMemoryMissionRuntimeStore())
    await expect(runtime.cancel(sessionPrincipal(OWNER), 'missing-mission')).rejects.toMatchObject({
      code: 'MISSION_NOT_FOUND',
    })
  })
})
