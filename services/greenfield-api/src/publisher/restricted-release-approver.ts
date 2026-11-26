import {sql} from 'kysely'
import type {ModulaDb} from '../database/client.js'

export type ReleaseApprovalDecisionSource = 'GOVERNANCE_DECISION' | 'AUTOMATED_TEST_POLICY'

export type RestrictedReleaseApprovalPolicy = {
  policyId: string
  evidenceReference: string
  decisionSource: ReleaseApprovalDecisionSource
  environment: 'development' | 'test' | 'production'
}

export type RestrictedReleaseApprovalRequest = {
  jobId: string
  candidateSha256: string
}

export type RestrictedReleaseApprovalReceipt = RestrictedReleaseApprovalRequest & {
  policyId: string
  evidenceReference: string
  decisionSource: ReleaseApprovalDecisionSource
  environment: RestrictedReleaseApprovalPolicy['environment']
  /** This runtime verifies database separation, not the identity of an external reviewer. */
  independentHumanApprovalAttested: false
}

/**
 * Fixed-operation release approver. Its database login has no table access and
 * can only bind an explicitly supplied job to its exact candidate digest.
 *
 * Governance evidence is required for operator traceability, but the current
 * database function does not persist it. Consequently this runtime never
 * claims that a decision was independent human production approval.
 */
export class RestrictedPublisherReleaseApprover {
  private readonly policy: RestrictedReleaseApprovalPolicy

  constructor(private readonly db: ModulaDb, policy: RestrictedReleaseApprovalPolicy) {
    this.policy = validateReleaseApprovalPolicy(policy)
  }

  async approve(request: RestrictedReleaseApprovalRequest): Promise<RestrictedReleaseApprovalReceipt> {
    const normalized = validateReleaseApprovalRequest(request)
    const result = await sql<{approved_sha256: string}>`
      SELECT greenfield_release_approver_record(
        ${normalized.jobId}, ${normalized.candidateSha256},
        ${this.policy.policyId}, ${this.policy.evidenceReference}, ${this.policy.decisionSource}
      ) AS approved_sha256
    `.execute(this.db)
    if (result.rows[0]?.approved_sha256 !== normalized.candidateSha256) {
      throw new Error('Release approver returned an inconsistent candidate digest')
    }
    return {
      ...normalized,
      policyId: this.policy.policyId,
      evidenceReference: this.policy.evidenceReference,
      decisionSource: this.policy.decisionSource,
      environment: this.policy.environment,
      independentHumanApprovalAttested: false,
    }
  }
}

export function releaseApprovalPolicyFromEnvironment(env: NodeJS.ProcessEnv): RestrictedReleaseApprovalPolicy {
  const environment = env.NODE_ENV === 'production' || env.NODE_ENV === 'test' ? env.NODE_ENV : 'development'
  return validateReleaseApprovalPolicy({
    policyId: env.MODULA_RELEASE_APPROVAL_POLICY_ID ?? '',
    evidenceReference: env.MODULA_RELEASE_APPROVAL_EVIDENCE_REFERENCE ?? '',
    decisionSource: env.MODULA_RELEASE_APPROVAL_DECISION_SOURCE as ReleaseApprovalDecisionSource,
    environment,
  })
}

export function releaseApprovalRequestFromArguments(args: readonly string[]): RestrictedReleaseApprovalRequest {
  if (args.length !== 2) throw new Error('Usage: publisher:release-approver <job-id> <candidate-sha256>')
  return validateReleaseApprovalRequest({jobId: args[0] ?? '', candidateSha256: args[1] ?? ''})
}

function validateReleaseApprovalPolicy(policy: RestrictedReleaseApprovalPolicy): RestrictedReleaseApprovalPolicy {
  const policyId = cleanEvidenceValue(policy.policyId, 'Release approval policy ID')
  const evidenceReference = cleanEvidenceValue(policy.evidenceReference, 'Release approval evidence reference')
  if (policy.decisionSource !== 'GOVERNANCE_DECISION' && policy.decisionSource !== 'AUTOMATED_TEST_POLICY') {
    throw new Error('MODULA_RELEASE_APPROVAL_DECISION_SOURCE must be GOVERNANCE_DECISION or AUTOMATED_TEST_POLICY')
  }
  if (policy.decisionSource === 'AUTOMATED_TEST_POLICY' && policy.environment !== 'test') {
    throw new Error('Automated test release approval is restricted to NODE_ENV=test')
  }
  return {...policy, policyId, evidenceReference}
}

function validateReleaseApprovalRequest(request: RestrictedReleaseApprovalRequest): RestrictedReleaseApprovalRequest {
  const jobId = request.jobId.trim()
  const candidateSha256 = request.candidateSha256.trim().toLowerCase()
  if (!/^prj_[0-9a-f-]{36}$/.test(jobId)) throw new Error('Release approval job ID is malformed')
  if (!/^[0-9a-f]{64}$/.test(candidateSha256)) throw new Error('Release approval candidate SHA-256 is malformed')
  return {jobId, candidateSha256}
}

function cleanEvidenceValue(value: string, label: string): string {
  const clean = value.trim()
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{2,239}$/.test(clean)) {
    throw new Error(`${label} must contain 3 to 240 safe reference characters`)
  }
  return clean
}
