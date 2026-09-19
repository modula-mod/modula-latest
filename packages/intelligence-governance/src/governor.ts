import type {AkiDecision, GovernorAuthorization, GovernorDecision, ModulaActionProposal} from '@modula/intelligence-contracts'

export class GovernorV0 {
  decide(input: {
    id: string
    proposal: ModulaActionProposal
    aki: AkiDecision
    createdAt?: string
  }): GovernorDecision {
    const authorization = authorize(input.aki)
    return {
      id: input.id,
      missionId: input.proposal.missionId,
      proposalId: input.proposal.id,
      authorization,
      allowedCapabilities: authorization === 'blocked' ? [] : [input.proposal.capability],
      constraints: constraints(authorization, input.aki),
      akiDecisionId: input.aki.id,
      createdAt: input.createdAt ?? new Date().toISOString(),
    }
  }
}

function authorize(aki: AkiDecision): GovernorAuthorization {
  if (aki.verdict === 'deny' || aki.risk === 'financial') return 'blocked'
  if (aki.verdict === 'abstain') return 'human_required'
  if (aki.risk === 'read_only' && aki.verdict === 'allow') return 'autonomous'
  if (aki.risk === 'write_reversible') return 'human_required'
  if (aki.risk === 'write_irreversible' || aki.risk === 'external_side_effect' || aki.risk === 'privileged' || aki.risk === 'unknown') return 'human_required'
  return 'blocked'
}

function constraints(authorization: GovernorAuthorization, aki: AkiDecision): string[] {
  const values = [`AKI_DECISION:${aki.id}`, `RISK:${aki.risk}`]
  if (authorization === 'human_required') values.push('VALID_APPROVAL_REQUIRED')
  if (authorization === 'blocked') values.push('EXECUTION_PROHIBITED')
  return values
}
