import {
  evidenceState,
  type AkiCheck,
  type DecisionEngine,
  type DecisionInput,
  type DecisionResult,
} from '@modula/intelligence-contracts'

export class DeterministicAkiDecisionFabric implements DecisionEngine {
  async evaluate(input: DecisionInput): Promise<DecisionResult> {
    const checks: AkiCheck[] = [
      check('schema', input.schemaValid, 'ACTION_SCHEMA_VALID', 'INVALID_ACTION_SCHEMA'),
      check('deterministic', input.registered, 'CAPABILITY_REGISTERED', 'CAPABILITY_UNKNOWN', 'uncertain'),
      check('permission', input.permissionGranted, 'PERMISSION_GRANTED', 'PERMISSION_DENIED'),
      check('policy', input.policyAllowed !== false, 'POLICY_ALLOWED', 'POLICY_DENIED'),
    ]
    const evidence = input.evidence ?? []
    const state = evidenceState(evidence, input.evidenceRequired)
    checks.push({
      id: 'evidence',
      source: 'evidence',
      status: !input.evidenceRequired ? 'not_applicable' : state === 'EVIDENCE_PRESENT' ? 'pass' : 'uncertain',
      reasonCode: state,
    })

    let verdict: DecisionResult['verdict'] = 'allow'
    const conditions: string[] = []
    if (!input.schemaValid || !input.permissionGranted || input.policyAllowed === false || input.risk === 'financial') verdict = 'deny'
    else if (!input.registered || input.risk === 'unknown' || state === 'INSUFFICIENT_EVIDENCE' || state === 'CONFLICTING_EVIDENCE') verdict = 'abstain'
    else if (input.risk !== 'read_only') {
      verdict = 'require_approval'
      conditions.push('HUMAN_APPROVAL_REQUIRED')
    }

    return {
      missionId: input.mission.id,
      proposalId: input.proposal.id,
      verdict,
      risk: input.risk,
      reversibility: input.reversibility,
      checks,
      evidence,
      evidenceState: state,
      conflicts: [],
      conditions,
    }
  }
}

function check(
  source: AkiCheck['source'],
  passed: boolean,
  passCode: string,
  failCode: string,
  failureStatus: AkiCheck['status'] = 'fail',
): AkiCheck {
  return {id: source, source, status: passed ? 'pass' : failureStatus, reasonCode: passed ? passCode : failCode}
}
