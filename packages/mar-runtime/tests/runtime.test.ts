import {readdirSync, readFileSync, statSync} from 'node:fs'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {describe, expect, it} from 'vitest'
import type {DecisionEngine, GaiaAvailableAction, GaiaPlan, GaiaPlanner, GaiaPlanningInput, ModulaActionProposal} from '@modula/intelligence-contracts'
import {IntelligenceError} from '@modula/intelligence-contracts'
import {DeterministicAkiDecisionFabric, GovernorV0} from '@modula/intelligence-governance'
import {
  InMemoryMissionRuntimeStore,
  MissionRuntime,
  RegisteredCapabilityPlanner,
  type MissionToolGateway,
  type VerifiedPrincipal,
} from '../src/index.js'

const SYNTHETIC_MODULE_ID = 'test.module.widgets'
const NOW = '2026-11-07T00:00:00.000Z'

const principal: VerifiedPrincipal = {
  accountId: 'account-verified',
  workspaceId: 'workspace-verified',
  assurance: {kind: 'verified', method: 'test-harness', verifiedAt: NOW},
}

const request = {
  objective: 'List widgets from the registered test module',
  correlationId: 'corr-widgets-001',
}

function syntheticActions(): GaiaAvailableAction[] {
  return [
    {
      family: 'record.query',
      capability: `records:module.${SYNTHETIC_MODULE_ID}.widget:read`,
      moduleId: SYNTHETIC_MODULE_ID,
      collection: 'widget',
    },
    {
      family: 'record.create',
      capability: `records:module.${SYNTHETIC_MODULE_ID}.widget:write`,
      moduleId: SYNTHETIC_MODULE_ID,
      collection: 'widget',
    },
  ]
}

class ManualClock {
  constructor(private ms = Date.parse(NOW), private iso = NOW) {}
  nowIso(): string { return this.iso }
  nowMs(): number { return this.ms }
  advance(ms: number): void {
    this.ms += ms
    this.iso = new Date(this.ms).toISOString()
  }
}

function ids() {
  let value = 0
  return () => `id-${++value}`
}

class RecordingTools implements MissionToolGateway {
  executions: ModulaActionProposal[] = []
  revalidateResult = {registered: true, schemaValid: true, permissionGranted: true, workspaceAccess: true}
  executeImpl?: (input: {accountId: string; proposal: ModulaActionProposal; signal: AbortSignal}) => Promise<unknown>

  async revalidate() {
    return this.revalidateResult
  }

  async execute(input: {accountId: string; proposal: ModulaActionProposal; signal: AbortSignal}) {
    if (this.executeImpl) return this.executeImpl(input)
    this.executions.push(input.proposal)
    return {ok: true, capability: input.proposal.capability}
  }
}

class ScriptedPlanner implements GaiaPlanner {
  calls = 0
  constructor(private readonly planFor: (input: GaiaPlanningInput) => Promise<GaiaPlan> | GaiaPlan) {}
  async plan(input: GaiaPlanningInput): Promise<GaiaPlan> {
    this.calls += 1
    return this.planFor(input)
  }
}

function deferred<T = void>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>(done => {
    resolve = done
  })
  return {promise, resolve}
}

function harness(options: {
  actions?: GaiaAvailableAction[]
  planner?: GaiaPlanner
  tools?: RecordingTools
  clock?: ManualClock
  budget?: {maxPlanSteps?: number; maxIterations?: number; maxDurationMs?: number}
  decisions?: DecisionEngine
  governor?: {decide(input: {id: string; proposal: ModulaActionProposal; aki: import('@modula/intelligence-contracts').AkiDecision; createdAt?: string}): import('@modula/intelligence-contracts').GovernorDecision}
  store?: InMemoryMissionRuntimeStore
  unregisteredCapabilities?: 'block' | 'verify'
} = {}) {
  const store = options.store ?? new InMemoryMissionRuntimeStore()
  const tools = options.tools ?? new RecordingTools()
  const clock = options.clock ?? new ManualClock()
  const planner = options.planner ?? new RegisteredCapabilityPlanner(ids(), 'record.query')
  let actions = options.actions ?? syntheticActions()
  const runtime = new MissionRuntime({
    store,
    planner,
    decisions: options.decisions ?? new DeterministicAkiDecisionFabric(),
    governor: options.governor ?? new GovernorV0(),
    capabilities: {list: async () => actions},
    tools,
    ids: ids(),
    clock,
    budget: options.budget,
    unregisteredCapabilities: options.unregisteredCapabilities,
  })
  return {
    store,
    tools,
    clock,
    planner,
    runtime,
    setActions(next: GaiaAvailableAction[]) { actions = next },
  }
}

function proposalFor(missionId: string, action: GaiaAvailableAction, input: Record<string, unknown>): ModulaActionProposal {
  return {
    id: 'proposal-scripted',
    missionId,
    moduleId: action.moduleId,
    family: action.family,
    capability: action.capability,
    input,
    requestedBy: 'gaia',
  }
}

function planWith(missionId: string, proposals: ModulaActionProposal[]): GaiaPlan {
  return {
    id: 'plan-scripted',
    missionId,
    version: 1,
    summary: 'Scripted plan',
    createdAt: NOW,
    steps: proposals.map((proposal, index) => ({
      id: `step-${index + 1}`,
      order: index + 1,
      description: `Dispatch ${proposal.family}`,
      capability: proposal.capability,
      actionProposal: proposal,
      dependencies: [],
      state: 'pending' as const,
    })),
  }
}

describe('mission runtime cycle', () => {
  it('completes a deterministic capability cycle and records sequenced ledger events', async () => {
    const {runtime, tools, store} = harness()
    const created = await runtime.createMission(principal, request)
    const completed = await runtime.start(principal, created.id)
    expect(completed.status).toBe('completed')
    expect(tools.executions).toHaveLength(1)
    expect(tools.executions[0]).toMatchObject({
      family: 'record.query',
      moduleId: SYNTHETIC_MODULE_ID,
      capability: `records:module.${SYNTHETIC_MODULE_ID}.widget:read`,
      input: {collection: 'widget', limit: 5},
    })
    const executions = await store.listExecutions(created.id)
    expect(executions).toHaveLength(1)
    expect(executions[0]).toMatchObject({status: 'completed', idempotencyKey: expect.stringContaining(created.id)})
    await runtime.execute(principal, created.id, executions[0]!.proposalId)
    expect(tools.executions).toHaveLength(1)
    const types = (await runtime.events(principal, created.id)).map(event => event.type)
    expect(types).toEqual([
      'mission.created',
      'mission.planning_started',
      'proposal.created',
      'plan.created',
      'aki.verification_started',
      'aki.decision_created',
      'governor.authorization_created',
      'execution.started',
      'execution.completed',
      'artifact.created',
      'mission.completed',
    ])
    const sequences = (await runtime.events(principal, created.id)).map(event => event.payload.sequence)
    expect(sequences).toEqual(types.map((_, index) => index + 1))
  })

  it('parks a side-effecting proposal for approval and does not dispatch it', async () => {
    const {runtime, tools, store} = harness({planner: new RegisteredCapabilityPlanner(ids(), 'record.create')})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-approval-01'})
    const pending = await runtime.start(principal, created.id)
    expect(pending.status).toBe('awaiting_approval')
    expect(tools.executions).toHaveLength(0)
    expect(await store.listExecutions(created.id)).toHaveLength(0)
    const approvalId = (await runtime.events(principal, created.id)).find(event => event.type === 'approval.requested')?.approvalId
    expect(approvalId).toBeTruthy()
    const completed = await runtime.decideApproval(principal, created.id, approvalId!, 'approved')
    expect(completed.status).toBe('completed')
    expect(tools.executions).toHaveLength(1)
    expect(tools.executions[0]?.family).toBe('record.create')
  })

  it('rejects an unregistered proposal and records the refusal without dispatch', async () => {
    const action = syntheticActions()[0]!
    const planner = new ScriptedPlanner(input => planWith(input.mission.id, [{
      ...proposalFor(input.mission.id, action, {}),
      family: 'unknown.superpower',
      capability: 'unknown.superpower',
      moduleId: undefined,
    }]))
    const {runtime, tools} = harness({planner})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-unknown-001'})
    await expect(runtime.start(principal, created.id)).rejects.toMatchObject({code: 'CAPABILITY_UNKNOWN'})
    expect((await runtime.events(principal, created.id)).map(event => event.type)).toEqual(expect.arrayContaining(['execution.blocked', 'mission.blocked']))
    const mission = await runtime.recover(principal, created.id).catch(error => error)
    expect(mission).toMatchObject({code: 'INVALID_MISSION_STATE'})
    expect(tools.executions).toHaveLength(0)
  })

  it('routes an unregistered proposal through AKI and the Governor when opted in, then blocks it', async () => {
    const action = syntheticActions()[0]!
    const planner = new ScriptedPlanner(input => planWith(input.mission.id, [{
      ...proposalFor(input.mission.id, action, {}),
      family: 'financial.fixture',
      capability: 'financial.fixture',
      moduleId: undefined,
    }]))
    const tools = new RecordingTools()
    tools.revalidateResult = {registered: false, schemaValid: false, permissionGranted: false, workspaceAccess: true}
    const {runtime, store} = harness({planner, tools, unregisteredCapabilities: 'verify'})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-unreg-verify1'})
    await expect(runtime.start(principal, created.id)).rejects.toMatchObject({code: expect.stringMatching(/^(AKI_DENIED|GOVERNOR_BLOCKED|CAPABILITY_UNKNOWN)$/)})
    const types = (await runtime.events(principal, created.id)).map(event => event.type)
    expect(types).toEqual(expect.arrayContaining(['proposal.created', 'aki.decision_created', 'governor.authorization_created', 'mission.blocked']))
    expect(types).not.toContain('approval.requested')
    expect(types).not.toContain('execution.started')
    expect((await store.readMission(created.id))?.status).toBe('blocked')
    expect(tools.executions).toHaveLength(0)
  })

  it('never dispatches an unregistered proposal even if AKI and the Governor allow it', async () => {
    const action = syntheticActions()[0]!
    const planner = new ScriptedPlanner(input => planWith(input.mission.id, [{
      ...proposalFor(input.mission.id, action, {}),
      family: 'unknown.superpower',
      capability: 'unknown.superpower',
      moduleId: undefined,
    }]))
    const tools = new RecordingTools()
    tools.revalidateResult = {registered: false, schemaValid: true, permissionGranted: true, workspaceAccess: true}
    const {runtime, store} = harness({
      planner,
      tools,
      unregisteredCapabilities: 'verify',
      decisions: {async evaluate(input) {
        return {missionId: input.mission.id, proposalId: input.proposal.id, verdict: 'allow', risk: input.risk, reversibility: input.reversibility, checks: [], evidence: [], evidenceState: 'NO_EVIDENCE', conflicts: [], conditions: []}
      }},
      governor: {decide(input) {
        return {id: input.id, missionId: input.proposal.missionId, proposalId: input.proposal.id, authorization: 'autonomous', allowedCapabilities: [input.proposal.capability], constraints: [], akiDecisionId: input.aki.id, createdAt: input.createdAt ?? NOW}
      }},
    })
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-unreg-allow01'})
    await expect(runtime.start(principal, created.id)).rejects.toMatchObject({code: 'CAPABILITY_UNKNOWN'})
    expect((await store.readMission(created.id))?.status).toBe('blocked')
    expect((await runtime.events(principal, created.id)).map(event => event.type)).not.toContain('execution.started')
    expect(tools.executions).toHaveLength(0)
  })

  it('still refuses a shell proposal at planning when unregistered routing is opted in', async () => {
    const shell: GaiaAvailableAction = {family: 'shell.exec', capability: 'shell.exec', moduleId: SYNTHETIC_MODULE_ID}
    const planner = new ScriptedPlanner(input => planWith(input.mission.id, [proposalFor(input.mission.id, shell, {command: 'uname'})]))
    const {runtime, tools} = harness({planner, actions: [], unregisteredCapabilities: 'verify'})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-unreg-shell1'})
    await expect(runtime.start(principal, created.id)).rejects.toMatchObject({code: 'CAPABILITY_DENIED'})
    expect((await runtime.events(principal, created.id)).map(event => event.type)).not.toContain('proposal.created')
    expect(tools.executions).toHaveLength(0)
  })

  it('refuses a host execution field on an otherwise registered capability', async () => {
    const action = syntheticActions()[0]!
    const planner = new ScriptedPlanner(input => planWith(input.mission.id, [
      proposalFor(input.mission.id, action, {collection: 'widget', command: 'uname'}),
    ]))
    const {runtime, tools} = harness({planner})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-command-01'})
    await expect(runtime.start(principal, created.id)).rejects.toMatchObject({code: 'CAPABILITY_DENIED'})
    expect(tools.executions).toHaveLength(0)
  })

  it('refuses a shell proposal even when the catalog lists it', async () => {
    const shell: GaiaAvailableAction = {family: 'shell.exec', capability: 'shell.exec', moduleId: SYNTHETIC_MODULE_ID}
    const planner = new ScriptedPlanner(input => planWith(input.mission.id, [proposalFor(input.mission.id, shell, {command: 'uname'})]))
    const {runtime, tools, store} = harness({planner, actions: [shell]})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-shell-0001'})
    await expect(runtime.start(principal, created.id)).rejects.toMatchObject({code: 'CAPABILITY_DENIED'})
    expect(tools.executions).toHaveLength(0)
    expect((await store.readMission(created.id))?.status).toBe('blocked')
    expect((await runtime.events(principal, created.id)).map(event => event.type)).toContain('execution.blocked')
  })

  it('does not execute when verification denies the proposal', async () => {
    const {runtime, tools} = harness({
      decisions: {async evaluate(input) {
        return {
          missionId: input.mission.id,
          proposalId: input.proposal.id,
          verdict: 'deny',
          risk: input.risk,
          reversibility: input.reversibility,
          checks: [],
          evidence: [],
          evidenceState: 'NO_EVIDENCE',
          conflicts: [],
          conditions: [],
        }
      }},
      governor: {decide(input) {
        return {
          id: input.id,
          missionId: input.proposal.missionId,
          proposalId: input.proposal.id,
          authorization: 'autonomous',
          allowedCapabilities: [input.proposal.capability],
          constraints: [],
          akiDecisionId: input.aki.id,
          createdAt: input.createdAt ?? NOW,
        }
      }},
    })
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-deny-00001'})
    await expect(runtime.start(principal, created.id)).rejects.toMatchObject({code: 'AKI_DENIED'})
    expect(tools.executions).toHaveLength(0)
  })

  it('cancels during planning and does not dispatch', async () => {
    const gate = deferred<void>()
    const reached = deferred<void>()
    const planner = new ScriptedPlanner(async input => {
      reached.resolve()
      await gate.promise
      return planWith(input.mission.id, [proposalFor(input.mission.id, syntheticActions()[0]!, {collection: 'widget'})])
    })
    const {runtime, tools} = harness({planner})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-cancel-001'})
    const pending = runtime.start(principal, created.id)
    await reached.promise
    const cancelled = await runtime.cancel(principal, created.id)
    expect(cancelled.status).toBe('cancelled')
    gate.resolve()
    await expect(pending).resolves.toMatchObject({status: 'cancelled'})
    expect(tools.executions).toHaveLength(0)
    expect(planner.calls).toBe(1)
    await expect(runtime.recover(principal, created.id)).rejects.toMatchObject({code: 'INVALID_MISSION_STATE'})
  })

  it('cancels during dispatch and does not record a successful result', async () => {
    const entered = deferred<void>()
    const release = deferred<void>()
    const tools = new RecordingTools()
    tools.executeImpl = async input => {
      entered.resolve()
      await release.promise
      if (input.signal.aborted) throw new IntelligenceError('EXECUTION_FAILED', 'interrupted')
      tools.executions.push(input.proposal)
      return {ok: true}
    }
    const {runtime, store} = harness({tools})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-cancel-run'})
    const pending = runtime.start(principal, created.id)
    await entered.promise
    await runtime.cancel(principal, created.id)
    release.resolve()
    await expect(pending).resolves.toMatchObject({status: 'cancelled'})
    expect(tools.executions).toHaveLength(0)
    expect(await store.listExecutions(created.id)).toMatchObject([{status: 'failed'}])
    expect((await store.readMission(created.id))?.status).toBe('cancelled')
  })

  it('returns the same mission for a duplicate idempotency key', async () => {
    const {runtime, store} = harness()
    const first = await runtime.createMission(principal, request)
    const second = await runtime.createMission(principal, request)
    expect(second.id).toBe(first.id)
    expect(await store.countMissions()).toBe(1)
    await expect(runtime.createMission(principal, {...request, objective: 'A different objective'})).rejects.toMatchObject({
      code: 'INVALID_MISSION_STATE',
      details: {reason: 'IDEMPOTENCY_CONFLICT'},
    })
    expect(await store.countMissions()).toBe(1)
  })

  it('fails the mission when the plan exceeds the step budget', async () => {
    const planner = new ScriptedPlanner(input => planWith(input.mission.id, [
      proposalFor(input.mission.id, syntheticActions()[0]!, {collection: 'widget'}),
      proposalFor(input.mission.id, syntheticActions()[0]!, {collection: 'widget', limit: 1}),
    ]))
    const {runtime, tools, store} = harness({planner, budget: {maxPlanSteps: 1}})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-budget-001'})
    await expect(runtime.start(principal, created.id)).rejects.toMatchObject({
      code: 'EXECUTION_FAILED',
      details: {reason: 'BUDGET_EXCEEDED', maxPlanSteps: 1, planSteps: 2},
    })
    expect(tools.executions).toHaveLength(0)
    expect((await store.readMission(created.id))?.status).toBe('failed')
    await expect(runtime.recover(principal, created.id)).rejects.toMatchObject({code: 'INVALID_MISSION_STATE'})
    expect((await store.readMission(created.id))?.status).toBe('failed')
  })

  it('fails when the duration budget is exceeded and does not dispatch', async () => {
    const clock = new ManualClock()
    const planner = new ScriptedPlanner(input => {
      clock.advance(50)
      return planWith(input.mission.id, [proposalFor(input.mission.id, syntheticActions()[0]!, {collection: 'widget'})])
    })
    const {runtime, tools, store} = harness({planner, clock, budget: {maxDurationMs: 10}})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-budget-time'})
    await expect(runtime.start(principal, created.id)).rejects.toMatchObject({
      code: 'EXECUTION_FAILED',
      details: {reason: 'BUDGET_EXCEEDED'},
    })
    expect(tools.executions).toHaveLength(0)
    expect((await store.readMission(created.id))?.status).toBe('failed')
  })

  it('keeps a failed tool execution failed', async () => {
    const tools = new RecordingTools()
    tools.executeImpl = async () => {
      throw new Error('synthetic tool failure')
    }
    const {runtime, store} = harness({tools})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-failed-001'})
    await expect(runtime.start(principal, created.id)).rejects.toMatchObject({code: 'EXECUTION_FAILED'})
    expect((await store.readMission(created.id))?.status).toBe('failed')
    expect(await store.listExecutions(created.id)).toMatchObject([{status: 'failed', errorCode: 'EXECUTION_FAILED'}])
    const proposalId = (await store.listProposals(created.id))[0]?.id
    await expect(runtime.execute(principal, created.id, proposalId!)).rejects.toMatchObject({code: 'EXECUTION_FAILED'})
    expect(await store.listExecutions(created.id)).toHaveLength(1)
    await expect(runtime.recover(principal, created.id)).rejects.toMatchObject({code: 'INVALID_MISSION_STATE'})
    expect((await store.readMission(created.id))?.status).toBe('failed')
  })

  it('reloads a planning mission and refuses to resume a completed one', async () => {
    const store = new InMemoryMissionRuntimeStore()
    const planner = new RegisteredCapabilityPlanner(ids(), 'record.query')
    const first = harness({store, planner, actions: []})
    const created = await first.runtime.createMission(principal, {...request, correlationId: 'corr-recover-01'})
    const parked = await first.runtime.start(principal, created.id)
    expect(parked.status).toBe('planning')
    expect(first.tools.executions).toHaveLength(0)
    expect(planner.calls).toBe(1)

    const secondTools = new RecordingTools()
    const second = new MissionRuntime({
      store,
      planner,
      decisions: new DeterministicAkiDecisionFabric(),
      governor: new GovernorV0(),
      capabilities: {list: async () => syntheticActions()},
      tools: secondTools,
      ids: ids(),
      clock: new ManualClock(),
    })
    const continued = await second.recover(principal, created.id)
    expect(continued.status).toBe('completed')
    expect(secondTools.executions).toHaveLength(1)
    expect(planner.calls).toBe(2)
    await expect(second.recover(principal, created.id)).rejects.toMatchObject({code: 'INVALID_MISSION_STATE'})
    expect(secondTools.executions).toHaveLength(1)
    expect((await store.readMission(created.id))?.status).toBe('completed')
  })

  it('does not retry an in-flight execution after restart', async () => {
    const store = new InMemoryMissionRuntimeStore()
    const planner = new ScriptedPlanner(() => {
      throw new Error('planner must not run')
    })
    const tools = new RecordingTools()
    const runtime = new MissionRuntime({
      store,
      planner,
      decisions: new DeterministicAkiDecisionFabric(),
      governor: new GovernorV0(),
      capabilities: {list: async () => syntheticActions()},
      tools,
      ids: ids(),
      clock: new ManualClock(),
    })
    await store.insertMission({
      id: 'mission-inflight',
      userId: principal.accountId,
      workspaceId: principal.workspaceId,
      objective: request.objective,
      status: 'running',
      correlationId: 'corr-inflight-1',
      createdAt: NOW,
      updatedAt: NOW,
    })
    await store.writeExecution({
      id: 'execution-inflight',
      missionId: 'mission-inflight',
      proposalId: 'proposal-inflight',
      authorizationId: 'auth-inflight',
      status: 'running',
      idempotencyKey: 'mission:mission-inflight:proposal:proposal-inflight',
      createdAt: NOW,
    })
    const reloaded = await runtime.recover(principal, 'mission-inflight')
    expect(reloaded.status).toBe('running')
    expect(tools.executions).toHaveLength(0)
    await expect(runtime.execute(principal, 'mission-inflight', 'proposal-inflight')).rejects.toMatchObject({code: 'EXECUTION_ALREADY_COMPLETED'})
    expect(tools.executions).toHaveLength(0)
  })

  it('treats module absence as a waiting planning state', async () => {
    const {runtime, tools, setActions} = harness({actions: []})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-no-module1'})
    const waiting = await runtime.start(principal, created.id)
    expect(waiting.status).toBe('planning')
    expect(tools.executions).toHaveLength(0)
    setActions(syntheticActions())
    const completed = await runtime.recover(principal, created.id)
    expect(completed.status).toBe('completed')
    expect(tools.executions).toHaveLength(1)
    expect(tools.executions[0]?.moduleId).toBe(SYNTHETIC_MODULE_ID)
  })

  it('rejects client account identifiers and keeps the verified principal', async () => {
    const {runtime, store} = harness()
    await expect(runtime.createMission(principal, {...request, accountId: 'client-supplied'})).rejects.toMatchObject({code: 'MISSION_ACCESS_DENIED'})
    await expect(runtime.createMission({accountId: 'client-supplied'} as VerifiedPrincipal, request)).rejects.toMatchObject({code: 'MISSION_ACCESS_DENIED'})
    expect(await store.countMissions()).toBe(0)
    const created = await runtime.createMission(principal, {...request, workspaceId: 'client-workspace'})
    expect(created.userId).toBe(principal.accountId)
    expect(created.workspaceId).toBe(principal.workspaceId)
    await expect(runtime.start({...principal, accountId: 'other-account'}, created.id)).rejects.toMatchObject({code: 'MISSION_ACCESS_DENIED'})
  })

  it('redacts credential-shaped tool results before they are stored or emitted', async () => {
    const tools = new RecordingTools()
    tools.executeImpl = async input => {
      tools.executions.push(input.proposal)
      return {token: 'sk-live-secret', value: 1}
    }
    const {runtime, store} = harness({tools})
    const created = await runtime.createMission(principal, {...request, correlationId: 'corr-redact-001'})
    await runtime.start(principal, created.id)
    const execution = (await store.listExecutions(created.id))[0]
    expect(execution?.result).toMatchObject({token: '[redacted]', value: 1})
    const completed = (await runtime.events(principal, created.id)).find(event => event.type === 'execution.completed')
    expect(completed?.payload.result).toMatchObject({token: '[redacted]', value: 1})
    expect(JSON.stringify(completed)).not.toContain('sk-live-secret')
  })

  it('does not special-case an installable notes module in the kernel sources', () => {
    const root = fileURLToPath(new URL('../src/', import.meta.url))
    const files = walk(root).filter(file => file.endsWith('.ts'))
    expect(files.length).toBeGreaterThan(0)
    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      expect(source, file).not.toMatch(/vault-notes|Vault Notes|digital\.modula\.vault-notes/i)
    }
  })
})

function walk(directory: string): string[] {
  return readdirSync(directory).flatMap(entry => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
