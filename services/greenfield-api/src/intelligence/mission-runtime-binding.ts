import type {GaiaAvailableAction, ModulaActionProposal} from '@modula/intelligence-contracts'
import {IntelligenceError} from '@modula/intelligence-contracts'
import type {IntelligenceProviderRegistry} from '@modula/intelligence-core'
import {
  DeterministicAkiDecisionFabric,
  DeterministicTestPlanner,
  GovernorV0,
} from '@modula/intelligence-governance'
import {
  MissionRuntime,
  type MissionRuntimeDependencies,
  type MissionRuntimeStore,
} from '@modula/mar-runtime'
import type {AppConfig} from '../config/index.js'
import type {ModulaDb} from '../database/client.js'
import {uuidv7} from '../lib/uuidv7.js'
import {IntelligenceActionBoundary} from './action-boundary.js'
import {GreenfieldMissionRuntimeStore} from './mission-runtime-store.js'

/**
 * Supported blocked-state catalog entry. MissionRuntime's assessProposal will
 * not bind `module.absent` unless it appears in the capability list. The
 * planner still emits this family when no declared AI-callable action exists.
 * This is an adapter workaround; it is not a product capability.
 */
export const MODULE_ABSENT_ACTION: GaiaAvailableAction = {
  family: 'module.absent',
  capability: 'module.absent',
}

export type MissionRuntimePortTrace = {
  capabilitiesList: number
  planner: number
  decisions: number
  governor: number
  revalidate: number
  execute: number
}

export type MissionRuntimeTestHooks = {
  beforeExecute?: (input: {accountId: string; proposal: ModulaActionProposal; signal: AbortSignal}) => Promise<void>
}

export type GreenfieldMissionRuntimeOptions = {
  providers?: IntelligenceProviderRegistry
  store?: GreenfieldMissionRuntimeStore
}

type CachedRuntime = {
  runtime: MissionRuntime
  store: GreenfieldMissionRuntimeStore
  boundary: IntelligenceActionBoundary
  trace: MissionRuntimePortTrace
}

const cache = new WeakMap<ModulaDb, CachedRuntime>()
const testHooks = new WeakMap<ModulaDb, MissionRuntimeTestHooks>()

export function installGreenfieldMissionRuntimeTestHooks(db: ModulaDb, hooks?: MissionRuntimeTestHooks) {
  if (hooks) testHooks.set(db, hooks)
  else testHooks.delete(db)
}

export function getGreenfieldMissionRuntimeTrace(db: ModulaDb): MissionRuntimePortTrace | undefined {
  const cached = cache.get(db)
  return cached ? {...cached.trace} : undefined
}

export function resetGreenfieldMissionRuntimeTrace(db: ModulaDb) {
  const cached = cache.get(db)
  if (!cached) return
  cached.trace.capabilitiesList = 0
  cached.trace.planner = 0
  cached.trace.decisions = 0
  cached.trace.governor = 0
  cached.trace.revalidate = 0
  cached.trace.execute = 0
}

export function getGreenfieldMissionRuntimeStore(db: ModulaDb): GreenfieldMissionRuntimeStore | undefined {
  return cache.get(db)?.store
}

export function createGreenfieldMissionRuntimePorts(
  db: ModulaDb,
  config?: Pick<AppConfig, 'environment' | 'moduleAllowUntrustedDevelopmentReleases'>,
  options?: GreenfieldMissionRuntimeOptions,
): {store: GreenfieldMissionRuntimeStore; ports: Omit<MissionRuntimeDependencies, 'store' | 'ids' | 'clock' | 'budget'>; boundary: IntelligenceActionBoundary; trace: MissionRuntimePortTrace} {
  const store = options?.store ?? new GreenfieldMissionRuntimeStore(db)
  const boundary = new IntelligenceActionBoundary(db, config)
  const planner = new DeterministicTestPlanner(uuidv7)
  const decisions = new DeterministicAkiDecisionFabric()
  const governor = new GovernorV0()
  const trace: MissionRuntimePortTrace = {
    capabilitiesList: 0,
    planner: 0,
    decisions: 0,
    governor: 0,
    revalidate: 0,
    execute: 0,
  }
  const ports: Omit<MissionRuntimeDependencies, 'store' | 'ids' | 'clock' | 'budget'> = {
    planner: {
      plan: async input => {
        trace.planner += 1
        return planner.plan(input)
      },
    },
    decisions: {
      evaluate: async input => {
        trace.decisions += 1
        return decisions.evaluate(input)
      },
    },
    governor: {
      decide: input => {
        trace.governor += 1
        return governor.decide(input)
      },
    },
    capabilities: {
      list: async accountId => {
        trace.capabilitiesList += 1
        const actions = await boundary.availableActions(accountId)
        return actions.length > 0 ? actions : [MODULE_ABSENT_ACTION]
      },
    },
    tools: {
      revalidate: async (accountId, workspaceId, proposal) => {
        trace.revalidate += 1
        const result = await boundary.revalidate(accountId, workspaceId, proposal)
        return {
          registered: result.registered,
          schemaValid: result.schemaValid,
          permissionGranted: result.permissionGranted,
          workspaceAccess: result.workspaceAccess,
        }
      },
      execute: async input => {
        trace.execute += 1
        await testHooks.get(db)?.beforeExecute?.(input)
        if (input.signal.aborted) {
          throw new IntelligenceError('INVALID_MISSION_STATE', 'Mission was cancelled', {status: 'cancelled'})
        }
        return boundary.execute(input.accountId, input.proposal)
      },
    },
  }
  return {store, ports, boundary, trace}
}

export function getOrCreateGreenfieldMissionRuntime(
  db: ModulaDb,
  config?: Pick<AppConfig, 'environment' | 'moduleAllowUntrustedDevelopmentReleases'>,
  options?: GreenfieldMissionRuntimeOptions,
): CachedRuntime {
  const existing = cache.get(db)
  if (existing) return existing
  const {store, ports, boundary, trace} = createGreenfieldMissionRuntimePorts(db, config, options)
  const runtime = new MissionRuntime({
    store,
    ...ports,
    ids: uuidv7,
    unregisteredCapabilities: 'verify',
  })
  const cached = {runtime, store, boundary, trace}
  cache.set(db, cached)
  return cached
}

