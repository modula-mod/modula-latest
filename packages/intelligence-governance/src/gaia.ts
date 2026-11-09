import type {
  GaiaAvailableAction,
  GaiaPlan,
  GaiaPlanner,
  GaiaPlanningInput,
  ModulaActionProposal,
} from '@modula/intelligence-contracts'
import {IntelligenceError} from '@modula/intelligence-contracts'

export const RECENT_VAULT_NOTES_OBJECTIVE = 'Find my five most recently updated Vault Notes.'
export const REVERSIBLE_WRITE_FIXTURE_OBJECTIVE = 'Create the isolated GAI-01 approval fixture note.'
export const UNKNOWN_CAPABILITY_FIXTURE_OBJECTIVE = 'GAI-01 fixture: request unknown.superpower.'
export const FINANCIAL_FIXTURE_OBJECTIVE = 'GAI-01 fixture: request financial execution.'

type IdFactory = () => string

export class DeterministicTestPlanner implements GaiaPlanner {
  constructor(private readonly id: IdFactory = () => globalThis.crypto.randomUUID()) {}

  async plan(input: GaiaPlanningInput): Promise<GaiaPlan> {
    const proposal = this.proposal(input)
    const now = input.now ?? new Date().toISOString()
    return {
      id: this.id(),
      missionId: input.mission.id,
      version: 1,
      summary: `Deterministic acceptance plan for: ${input.mission.objective}`,
      createdAt: now,
      steps: [{
        id: this.id(),
        order: 1,
        description: proposal.family === 'record.query'
          ? 'Query the registered record collection using the owner-scoped Modula runtime.'
          : 'Submit the registered action through governance and the Modula runtime.',
        capability: proposal.capability,
        actionProposal: proposal,
        dependencies: [],
        state: 'pending',
      }],
    }
  }

  private proposal(input: GaiaPlanningInput): ModulaActionProposal {
    const common = {id: this.id(), missionId: input.mission.id, requestedBy: 'gaia' as const}
    // Isolated GAI-01 notes special cases — defects to retire, not a pattern to extend.
    if (input.mission.objective === RECENT_VAULT_NOTES_OBJECTIVE) {
      const action = find(input.availableActions, 'record.query', 'note')
      return {
        ...common,
        moduleId: action.moduleId,
        family: action.family,
        capability: action.capability,
        actionId: action.actionId,
        input: {collection: action.collection ?? 'note', limit: 5, sort: 'updatedAt', direction: 'desc'},
      }
    }
    if (input.mission.objective === REVERSIBLE_WRITE_FIXTURE_OBJECTIVE) {
      const action = find(input.availableActions, 'record.create', 'note')
      return {
        ...common,
        moduleId: action.moduleId,
        family: action.family,
        capability: action.capability,
        actionId: action.actionId,
        idempotencyKey: `gai01:${input.mission.id}:approval-fixture`,
        input: {
          collection: action.collection ?? 'note',
          data: {
            title: 'GAI-01 approval acceptance',
            document: {type: 'doc', content: []},
            plainTextProjection: 'Isolated GAI-01 approval acceptance fixture.',
            tagIds: [],
            pinned: false,
            favourite: false,
            archived: false,
            dataSchemaVersion: '1.0.0',
          },
        },
      }
    }
    if (input.mission.objective === UNKNOWN_CAPABILITY_FIXTURE_OBJECTIVE) {
      return {...common, family: 'unknown.superpower', capability: 'unknown.superpower', input: {}}
    }
    if (input.mission.objective === FINANCIAL_FIXTURE_OBJECTIVE) {
      return {...common, family: 'financial.fixture', capability: 'financial.fixture', input: {}}
    }
    return genericAuthorizedQuery(common, input.availableActions)
  }
}

function genericAuthorizedQuery(
  common: Pick<ModulaActionProposal, 'id' | 'missionId' | 'requestedBy'>,
  availableActions: GaiaAvailableAction[],
): ModulaActionProposal {
  const action = availableActions.find(candidate => candidate.family === 'record.query' && candidate.collection)
  if (!action?.collection) {
    const absent = availableActions.length === 0
    return {
      ...common,
      family: absent ? 'module.absent' : 'capability.unavailable',
      capability: absent ? 'module.absent' : 'capability.unavailable',
      input: {},
    }
  }
  return {
    ...common,
    moduleId: action.moduleId,
    family: action.family,
    capability: action.capability,
    actionId: action.actionId,
    input: {collection: action.collection, limit: queryLimit(action), sort: 'updatedAt', direction: 'desc'},
  }
}

function queryLimit(action: GaiaAvailableAction): number {
  const max = action.limits?.max ?? 100
  const min = action.limits?.min ?? 1
  const requested = action.limits?.default ?? 25
  return Math.min(max, Math.max(min, requested))
}

function find(actions: GaiaAvailableAction[], family: string, preferredCollection?: string): GaiaAvailableAction {
  const eligible = actions.filter(action => action.family === family)
  const found = eligible.find(action => action.collection === preferredCollection) ?? eligible[0]
  if (!found) throw new IntelligenceError('CAPABILITY_UNKNOWN', `No registered ${family} capability is available`)
  return found
}
