import {
  assertRuntimeSessionTransition,
  canLaunchRuntimeResolution,
  type GreenfieldResolvedModuleRuntimeSubject,
  type GreenfieldRuntimeReasonCode,
  type GreenfieldRuntimeSession,
  type GreenfieldRuntimeSessionKind,
  type GreenfieldRuntimeSessionState,
} from '@modula/greenfield-module-engine-contracts'
import {randomUUID} from 'node:crypto'
import {resolveRuntimeRequirements, type GreenfieldRuntimeResolutionOptions} from './compatibility-resolver.js'
import type {GreenfieldRuntimeProviderRegistry} from './provider-registry.js'
import type {GreenfieldRuntimeSessionStore} from './session-store.js'

export type GreenfieldRuntimeManagerOptions = {
  registry: GreenfieldRuntimeProviderRegistry
  sessionStore: GreenfieldRuntimeSessionStore
  clock?: () => Date
  idFactory?: () => string
}

export class GreenfieldRuntimeManager {
  private readonly registry: GreenfieldRuntimeProviderRegistry
  private readonly sessionStore: GreenfieldRuntimeSessionStore
  private readonly clock: () => Date
  private readonly idFactory: () => string

  constructor(options: GreenfieldRuntimeManagerOptions) {
    this.registry = options.registry
    this.sessionStore = options.sessionStore
    this.clock = options.clock ?? (() => new Date())
    this.idFactory = options.idFactory ?? (() => `runtime-${randomUUID()}`)
  }

  async createModuleSession(
    subject: GreenfieldResolvedModuleRuntimeSubject,
    options: GreenfieldRuntimeResolutionOptions = {},
  ): Promise<GreenfieldRuntimeSession> {
    const now = this.now()
    const created = await this.sessionStore.create({
      sessionId: this.idFactory(),
      sessionKind: 'module',
      accountId: subject.accountId,
      moduleId: subject.moduleId,
      installationId: subject.installationId,
      releaseId: subject.releaseId,
      providerIds: [],
      state: 'creating',
      reasonCodes: ['runtime.session.created'],
      metadata: {},
      createdAt: now,
      updatedAt: now,
    })

    await this.transition(created.sessionId, 'resolving')
    const resolution = resolveRuntimeRequirements(subject, this.registry, options)
    await this.sessionStore.update(created.sessionId, {
      resolution,
      providerIds: resolution.selectedProviders.map(provider => provider.providerId),
      reasonCodes: resolution.reasonCodes,
      updatedAt: this.now(),
    })

    if (!canLaunchRuntimeResolution(resolution)) {
      return this.fail(created.sessionId, firstFailureCode(resolution.reasonCodes), 'Runtime requirements were not satisfied')
    }

    await this.transition(created.sessionId, 'preparing')
    try {
      await this.prepareProviders(created.sessionId, subject)
    } catch (error) {
      return this.fail(created.sessionId, 'provider.failed', error instanceof Error ? error.message : 'Runtime provider failed')
    }
    return this.transition(created.sessionId, 'ready')
  }

  async createLogicalSession(input: {
    sessionKind: Exclude<GreenfieldRuntimeSessionKind, 'module'>
    accountId: string
    providerIds?: string[]
    metadata?: Record<string, string | number | boolean | null>
  }): Promise<GreenfieldRuntimeSession> {
    const now = this.now()
    return this.sessionStore.create({
      sessionId: this.idFactory(),
      sessionKind: input.sessionKind,
      accountId: input.accountId,
      providerIds: input.providerIds ?? [],
      state: 'creating',
      reasonCodes: ['runtime.session.created'],
      metadata: input.metadata ?? {},
      createdAt: now,
      updatedAt: now,
    })
  }

  getSession(sessionId: string): Promise<GreenfieldRuntimeSession | null> {
    return this.sessionStore.get(sessionId)
  }

  listAccountSessions(accountId: string): Promise<GreenfieldRuntimeSession[]> {
    return this.sessionStore.listForAccount(accountId)
  }

  async start(sessionId: string): Promise<GreenfieldRuntimeSession> {
    await this.transition(sessionId, 'starting')
    return this.transition(sessionId, 'active', {startedAt: this.now()})
  }

  async suspend(sessionId: string): Promise<GreenfieldRuntimeSession> {
    await this.transition(sessionId, 'suspending')
    return this.transition(sessionId, 'suspended')
  }

  async resume(sessionId: string): Promise<GreenfieldRuntimeSession> {
    await this.transition(sessionId, 'resuming')
    return this.transition(sessionId, 'active')
  }

  async stop(sessionId: string): Promise<GreenfieldRuntimeSession> {
    await this.transition(sessionId, 'stopping')
    return this.transition(sessionId, 'terminated', {terminatedAt: this.now()})
  }

  async fail(
    sessionId: string,
    failureCode: GreenfieldRuntimeReasonCode,
    failureMessage: string,
  ): Promise<GreenfieldRuntimeSession> {
    const session = await this.requireSession(sessionId)
    if (session.state !== 'failed') {
      assertRuntimeSessionTransition(session.state, 'failed')
    }
    return this.sessionStore.update(sessionId, {
      state: 'failed',
      failureCode,
      failureMessage,
      reasonCodes: ['runtime.session.failed', failureCode],
      updatedAt: this.now(),
    })
  }

  async recover(sessionId: string): Promise<GreenfieldRuntimeSession> {
    return this.transition(sessionId, 'recovering')
  }

  async transition(
    sessionId: string,
    nextState: GreenfieldRuntimeSessionState,
    patch: Partial<Pick<GreenfieldRuntimeSession, 'startedAt' | 'terminatedAt'>> = {},
  ): Promise<GreenfieldRuntimeSession> {
    const session = await this.requireSession(sessionId)
    assertRuntimeSessionTransition(session.state, nextState)
    return this.sessionStore.update(sessionId, {
      state: nextState,
      reasonCodes: ['runtime.session.transitioned'],
      ...patch,
      updatedAt: this.now(),
    })
  }

  private async prepareProviders(sessionId: string, subject: GreenfieldResolvedModuleRuntimeSubject): Promise<void> {
    const session = await this.requireSession(sessionId)
    const resolution = session.resolution
    if (!resolution) throw new Error('Runtime session has no resolution')
    for (const selected of resolution.selectedProviders) {
      const adapter = this.registry.get(selected.providerId)
      if (!adapter) throw new Error(`Selected provider is no longer registered: ${selected.providerId}`)
      const prepared = adapter.prepareSession
        ? await adapter.prepareSession({subject, resolution, session})
        : {ready: true}
      if (!prepared.ready) throw new Error(`Runtime provider was not ready: ${selected.providerId}`)
      if (prepared.metadata) {
        await this.sessionStore.update(sessionId, {metadata: prepared.metadata, updatedAt: this.now()})
      }
    }
  }

  private async requireSession(sessionId: string): Promise<GreenfieldRuntimeSession> {
    const session = await this.sessionStore.get(sessionId)
    if (!session) throw new Error(`Runtime session not found: ${sessionId}`)
    return session
  }

  private now(): string {
    return this.clock().toISOString()
  }
}

function firstFailureCode(reasonCodes: GreenfieldRuntimeReasonCode[]): GreenfieldRuntimeReasonCode {
  return reasonCodes.find(code => code !== 'runtime.session.created' && code !== 'runtime.session.transitioned') ?? 'provider.unavailable'
}
