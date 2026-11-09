import type {GaiaPlan, GaiaPlanner, GaiaPlanningInput, ModulaActionProposal} from '@modula/intelligence-contracts'

type IdFactory = () => string

/**
 * Deterministic planner for tests and local dry-runs.
 * It binds the requested family to whatever capability the catalog registered.
 * It does not name or require any installable product module.
 */
export class RegisteredCapabilityPlanner implements GaiaPlanner {
  calls = 0

  constructor(
    private readonly ids: IdFactory,
    private readonly family = 'record.query',
  ) {}

  async plan(input: GaiaPlanningInput): Promise<GaiaPlan> {
    this.calls += 1
    const now = input.now ?? new Date().toISOString()
    const action = input.availableActions.find(candidate => candidate.family === this.family)
    if (!action) {
      return {
        id: this.ids(),
        missionId: input.mission.id,
        version: 1,
        summary: 'No registered capability is available',
        steps: [],
        createdAt: now,
      }
    }
    const proposalId = this.ids()
    const proposal: ModulaActionProposal = {
      id: proposalId,
      missionId: input.mission.id,
      moduleId: action.moduleId,
      family: action.family,
      capability: action.capability,
      actionId: action.actionId,
      input: action.family === 'record.create'
        ? {collection: action.collection, data: {name: 'synthetic-fixture'}}
        : {collection: action.collection, limit: 5},
      requestedBy: 'gaia',
      idempotencyKey: `mission:${input.mission.id}:proposal:${proposalId}`,
    }
    return {
      id: this.ids(),
      missionId: input.mission.id,
      version: 1,
      summary: `Use registered ${action.family} on ${action.moduleId ?? 'the authorized module'}`,
      createdAt: now,
      steps: [{
        id: this.ids(),
        order: 1,
        description: `Dispatch registered ${action.family}`,
        capability: action.capability,
        actionProposal: proposal,
        dependencies: [],
        state: 'pending',
      }],
    }
  }
}
