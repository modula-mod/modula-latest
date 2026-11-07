import {describe, expect, it} from 'vitest'
import type {AkiDecision, DecisionInput, IntelligenceMission, ModulaActionProposal} from '@modula/intelligence-contracts'
import {DeterministicAkiDecisionFabric, DeterministicTestPlanner, GovernorV0, RECENT_VAULT_NOTES_OBJECTIVE, assertCommandBoundary, classifyActionRisk} from '../src/index.js'

const mission: IntelligenceMission = {id: 'mission', userId: 'user', objective: 'test', status: 'awaiting_verification', correlationId: 'corr', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z'}
const proposal: ModulaActionProposal = {id: 'proposal', missionId: mission.id, family: 'record.query', capability: 'records:test:read', input: {}, requestedBy: 'gaia'}

async function aki(patch: Partial<DecisionInput> = {}): Promise<AkiDecision> {
  const risk = classifyActionRisk(patch.proposal?.family ?? proposal.family)
  const result = await new DeterministicAkiDecisionFabric().evaluate({mission, proposal, registered: true, schemaValid: true, permissionGranted: true, risk: risk.risk, reversibility: risk.reversibility, ...patch})
  return {id: 'aki', createdAt: '2026-01-01T00:00:00.000Z', ...result}
}

describe('AKI v0', () => {
  it('allows registered, valid, permitted reads', async () => expect((await aki()).verdict).toBe('allow'))
  it('denies malformed input and missing permission', async () => {
    expect((await aki({schemaValid: false})).verdict).toBe('deny')
    expect((await aki({permissionGranted: false})).verdict).toBe('deny')
  })
  it('abstains on unknown capabilities and unknown risk', async () => {
    expect((await aki({registered: false})).verdict).toBe('abstain')
    expect((await aki({risk: 'unknown'})).verdict).toBe('abstain')
  })
  it('blocks financial intent at verification', async () => expect((await aki({risk: 'financial'})).verdict).toBe('deny'))
  it('does not accept unsupported derived model reasoning as evidence', async () => {
    const decision = await aki({evidenceRequired: true, evidence: [{id: 'thought', kind: 'derived'}]})
    expect(decision.evidenceState).toBe('INSUFFICIENT_EVIDENCE')
    expect(decision.verdict).toBe('abstain')
  })
})

const syntheticModuleId = 'test.modula.synthetic-records'
const syntheticCollection = 'item'
const syntheticReadCapability = `records:module.${syntheticModuleId}.${syntheticCollection}:read`
const genericQueryObjective = 'Query the authorized module collection for recently updated records.'
const syntheticQueryAction = {
  family: 'record.query' as const,
  capability: syntheticReadCapability,
  moduleId: syntheticModuleId,
  collection: syntheticCollection,
}

function planner() {
  let sequence = 0
  return new DeterministicTestPlanner(() => `id-${++sequence}`)
}

describe('deterministic GAIA v0', () => {
  it('isolates the Vault Notes GAI-01 special case as a defect to retire', async () => {
    const plan = await planner().plan({
      mission: {...mission, objective: RECENT_VAULT_NOTES_OBJECTIVE},
      availableActions: [{family: 'record.query', capability: 'records:module.digital.modula.vault-notes.note:read', moduleId: 'digital.modula.vault-notes', collection: 'note'}],
      now: '2026-01-01T00:00:00.000Z',
    })
    expect(plan.steps).toHaveLength(1)
    expect(plan.steps[0]?.actionProposal).toMatchObject({family: 'record.query', input: {collection: 'note', limit: 5, sort: 'updatedAt', direction: 'desc'}})
  })
})

describe('generic GAIA discovery from authorized module actions', () => {
  it('maps an authorized synthetic-module action to record.query without product-specific IDs', async () => {
    const plan = await planner().plan({
      mission: {...mission, objective: genericQueryObjective},
      availableActions: [syntheticQueryAction],
      now: '2026-01-01T00:00:00.000Z',
    })
    expect(plan.steps[0]?.actionProposal).toMatchObject({
      family: 'record.query',
      moduleId: syntheticModuleId,
      capability: syntheticReadCapability,
      input: {collection: syntheticCollection, limit: 25, sort: 'updatedAt', direction: 'desc'},
    })
    expect(plan.steps[0]?.actionProposal.moduleId).not.toBe('digital.modula.vault-notes')
    expect(String(plan.steps[0]?.actionProposal.capability)).not.toContain('vault-notes')
  })

  it('honors a limit declared on the available action instead of parsing a number from the objective', async () => {
    const plan = await planner().plan({
      mission: {...mission, objective: 'Query the authorized module collection for the five most recently updated records.'},
      availableActions: [{...syntheticQueryAction, limits: {min: 1, max: 100, default: 10}}],
      now: '2026-01-01T00:00:00.000Z',
    })
    expect(plan.steps[0]?.actionProposal.input).toEqual({
      collection: syntheticCollection,
      limit: 10,
      sort: 'updatedAt',
      direction: 'desc',
    })
  })

  it('keeps limit 25 when the declaration omits a limit, even if the objective mentions a number', async () => {
    const plan = await planner().plan({
      mission: {...mission, objective: 'Return the five most recently updated records from the authorized module collection.'},
      availableActions: [syntheticQueryAction],
      now: '2026-01-01T00:00:00.000Z',
    })
    expect(plan.steps[0]?.actionProposal.input).toMatchObject({
      collection: syntheticCollection,
      limit: 25,
      sort: 'updatedAt',
      direction: 'desc',
    })
  })

  it('clamps a declared default to the declared maximum', async () => {
    const plan = await planner().plan({
      mission: {...mission, objective: genericQueryObjective},
      availableActions: [{...syntheticQueryAction, limits: {min: 1, max: 8, default: 25}}],
      now: '2026-01-01T00:00:00.000Z',
    })
    expect(plan.steps[0]?.actionProposal.input).toMatchObject({limit: 8})
  })

  it('treats module absence as a supported blocked state', async () => {
    const plan = await planner().plan({
      mission: {...mission, objective: genericQueryObjective},
      availableActions: [],
    })
    const proposal = plan.steps[0]!.actionProposal
    expect(proposal).toMatchObject({family: 'module.absent', capability: 'module.absent', input: {}})
    const decision = await aki({proposal, registered: false, permissionGranted: false, ...classifyActionRisk(proposal.family)})
    expect(decision.verdict).toBe('deny')
    expect(new GovernorV0().decide({id: 'gov', proposal, aki: decision}).authorization).toBe('blocked')
  })

  it('refuses authorization when the discovered action is no longer permitted', async () => {
    const plan = await planner().plan({
      mission: {...mission, objective: genericQueryObjective},
      availableActions: [syntheticQueryAction],
    })
    const proposal = plan.steps[0]!.actionProposal
    const decision = await aki({proposal, permissionGranted: false})
    expect(decision.verdict).toBe('deny')
    expect(new GovernorV0().decide({id: 'gov', proposal, aki: decision}).authorization).toBe('blocked')
  })
})

describe('Governor v0', () => {
  it('authorizes allowed reads autonomously', async () => {
    expect(new GovernorV0().decide({id: 'gov', proposal, aki: await aki()}).authorization).toBe('autonomous')
  })
  it('makes AKI DENY to autonomous impossible', async () => {
    const decision = new GovernorV0().decide({id: 'gov', proposal, aki: await aki({schemaValid: false})})
    expect(decision.authorization).toBe('blocked')
    expect(decision.authorization).not.toBe('autonomous')
  })
  it.each([
    ['write_irreversible', 'human_required'],
    ['external_side_effect', 'human_required'],
    ['privileged', 'human_required'],
    ['unknown', 'human_required'],
    ['financial', 'blocked'],
  ] as const)('maps %s risk to %s', async (risk, expected) => {
    const decision = await aki({risk, schemaValid: true, registered: risk !== 'unknown'})
    expect(new GovernorV0().decide({id: 'gov', proposal, aki: decision}).authorization).toBe(expected)
  })
})

describe('Command boundary', () => {
  it('rejects wrong-proposal authorization, revoked permission, stale schema, and missing approval', async () => {
    const authorization = new GovernorV0().decide({id: 'gov', proposal, aki: await aki()})
    const base = {proposal, authorization, permissionGranted: true, workspaceAccess: true, schemaValid: true, executionCompleted: false}
    expect(() => assertCommandBoundary({...base, authorization: {...authorization, proposalId: 'other'}})).toThrow(/identity/)
    expect(() => assertCommandBoundary({...base, permissionGranted: false})).toThrow(/revoked/)
    expect(() => assertCommandBoundary({...base, schemaValid: false})).toThrow(/schema/)
    expect(() => assertCommandBoundary({...base, authorization: {...authorization, authorization: 'human_required'}})).toThrow(/approval/)
  })
})
