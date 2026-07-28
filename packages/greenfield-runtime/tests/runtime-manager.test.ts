import {describe, expect, it} from 'vitest'
import type {GreenfieldResolvedModuleRuntimeSubject} from '@modula/greenfield-module-engine-contracts'
import {
  createTrustedBuiltInRuntimeProviders,
  GreenfieldRuntimeManager,
  GreenfieldRuntimeProviderRegistry,
  InMemoryGreenfieldRuntimeSessionStore,
  resolveRuntimeRequirements,
} from '../src/index.js'

function registry() {
  const providerRegistry = new GreenfieldRuntimeProviderRegistry()
  providerRegistry.registerMany(createTrustedBuiltInRuntimeProviders())
  return providerRegistry
}

function vaultSubject(overrides: Partial<GreenfieldResolvedModuleRuntimeSubject> = {}): GreenfieldResolvedModuleRuntimeSubject {
  return {
    accountId: 'account-1',
    moduleId: 'digital.modula.vault-notes',
    installationId: 'installation-1',
    installationStatus: 'enabled',
    releaseId: 'release-1',
    releaseVersion: '0.2.0',
    releaseState: 'published',
    trustLevel: 'firstParty',
    grantedPermissions: ['declarative-ui.render', 'records.read', 'records.write', 'actions.invoke'],
    engineRequirements: [
      {
        requirementId: 'ui',
        kind: 'declarative-ui',
        capabilities: ['declarative-ui.render'],
        fallbackPolicy: 'required',
      },
      {
        requirementId: 'records',
        kind: 'records',
        capabilities: ['records.read', 'records.write'],
        fallbackPolicy: 'required',
      },
      {
        requirementId: 'actions',
        kind: 'actions',
        capabilities: ['actions.invoke'],
        fallbackPolicy: 'required',
      },
    ],
    ...overrides,
  }
}

describe('Greenfield Runtime Manager', () => {
  it('resolves an installed module to trusted providers and a ready logical session', async () => {
    const providerRegistry = registry()
    const store = new InMemoryGreenfieldRuntimeSessionStore()
    const manager = new GreenfieldRuntimeManager({
      registry: providerRegistry,
      sessionStore: store,
      idFactory: () => 'runtime-session-1',
      clock: () => new Date('2026-07-28T12:00:00.000Z'),
    })

    const session = await manager.createModuleSession(vaultSubject(), {platform: 'web'})
    expect(session.state).toBe('ready')
    expect(session.providerIds).toEqual(['modula.declarative-ui', 'modula.records', 'modula.actions'])
    expect(session.resolution?.compatibility).toBe('compatible')
    expect(session.resolution?.launchPermission).toBe('allowed')
    expect(session.resolution?.unresolvedRequirements).toEqual([])

    const active = await manager.start(session.sessionId)
    expect(active.state).toBe('active')
    const suspended = await manager.suspend(session.sessionId)
    expect(suspended.state).toBe('suspended')
    const resumed = await manager.resume(session.sessionId)
    expect(resumed.state).toBe('active')
    const terminated = await manager.stop(session.sessionId)
    expect(terminated.state).toBe('terminated')
  })

  it('returns a structured denial when account permissions are missing', () => {
    const result = resolveRuntimeRequirements(
      vaultSubject({grantedPermissions: ['declarative-ui.render']}),
      registry(),
      {platform: 'web'},
    )

    expect(result.compatibility).toBe('blocked')
    expect(result.launchPermission).toBe('denied')
    expect(result.deniedCapabilities).toContain('records.read')
    expect(result.reasonCodes).toContain('permission.denied')
  })

  it('does not launch controlled framework stubs before their frameworks are configured', () => {
    const result = resolveRuntimeRequirements(
      vaultSubject({
        grantedPermissions: ['ai.chat'],
        engineRequirements: [
          {
            requirementId: 'ai-chat',
            kind: 'ai',
            capabilities: ['ai.chat'],
            fallbackPolicy: 'required',
          },
        ],
      }),
      registry(),
      {platform: 'web'},
    )

    expect(result.compatibility).toBe('blocked')
    expect(result.launchPermission).toBe('denied')
    expect(result.unresolvedRequirements[0]?.reasonCodes).toContain('provider.unavailable')
    expect(result.reasonCodes).toContain('provider.not-configured')
    expect(result.reasonCodes).toContain('provider.not-launchable')
  })

  it('allows degraded launch when optional runtime requirements are unavailable', () => {
    const result = resolveRuntimeRequirements(
      vaultSubject({
        engineRequirements: [
          vaultSubject().engineRequirements[0]!,
          {
            requirementId: 'optional-ai',
            kind: 'ai',
            capabilities: ['ai.chat'],
            fallbackPolicy: 'optional',
            requiredPermissions: ['ai.chat'],
          },
        ],
      }),
      registry(),
      {platform: 'web'},
    )

    expect(result.compatibility).toBe('degraded')
    expect(result.launchPermission).toBe('degraded-only')
    expect(result.selectedProviders).toHaveLength(1)
    expect(result.unresolvedRequirements[0]?.requirementId).toBe('optional-ai')
    expect(result.reasonCodes).toContain('requirements.resolved')
  })

  it('reports unavailable native build requirements without selecting a provider', () => {
    const records = registry().get('modula.records')
    expect(records).toBeDefined()
    const providerRegistry = new GreenfieldRuntimeProviderRegistry()
    providerRegistry.register({
      provider: {
        ...records!.provider,
        providerId: 'modula.records-native',
        nativeBuildRequired: true,
      },
    })

    const result = resolveRuntimeRequirements(
      vaultSubject({
        grantedPermissions: ['records.read'],
        engineRequirements: [
          {
            requirementId: 'native-records',
            kind: 'records',
            capabilities: ['records.read'],
            fallbackPolicy: 'required',
            nativeBuildPolicy: 'forbidden',
          },
        ],
      }),
      providerRegistry,
      {platform: 'web'},
    )

    expect(result.nativeBuildRequirement).toBe('unavailable')
    expect(result.compatibility).toBe('blocked')
    expect(result.launchPermission).toBe('denied')
    expect(result.reasonCodes).toContain('native-build.unavailable')
  })

  it('fails sessions without crashing when a trusted provider adapter fails', async () => {
    const providerRegistry = new GreenfieldRuntimeProviderRegistry()
    const [uiProvider, ...rest] = createTrustedBuiltInRuntimeProviders()
    providerRegistry.register({
      ...uiProvider!,
      async prepareSession() {
        throw new Error('prepare failed')
      },
    })
    providerRegistry.registerMany(rest)
    const manager = new GreenfieldRuntimeManager({
      registry: providerRegistry,
      sessionStore: new InMemoryGreenfieldRuntimeSessionStore(),
      idFactory: () => 'runtime-session-2',
    })

    const session = await manager.createModuleSession(vaultSubject({engineRequirements: [vaultSubject().engineRequirements[0]!]}))
    expect(session.state).toBe('failed')
    expect(session.failureCode).toBe('provider.failed')
    expect(session.reasonCodes).toContain('runtime.session.failed')
  })

  it('rejects unsafe lifecycle jumps', async () => {
    const manager = new GreenfieldRuntimeManager({
      registry: registry(),
      sessionStore: new InMemoryGreenfieldRuntimeSessionStore(),
      idFactory: () => 'runtime-session-3',
    })
    const session = await manager.createModuleSession(vaultSubject())
    await manager.start(session.sessionId)
    await expect(manager.transition(session.sessionId, 'terminated')).rejects.toThrow(/Invalid runtime session transition/)
  })
})
