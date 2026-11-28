import {describe, expect, it} from 'vitest'
import {
  releaseApprovalPolicyFromEnvironment,
  releaseApprovalRequestFromArguments,
} from '../src/publisher/restricted-release-approver.js'

describe('restricted release approver configuration', () => {
  it('accepts an explicit governance decision without attesting human independence', () => {
    expect(releaseApprovalPolicyFromEnvironment({
      NODE_ENV: 'production',
      MODULA_RELEASE_APPROVAL_POLICY_ID: 'release-policy:v1',
      MODULA_RELEASE_APPROVAL_EVIDENCE_REFERENCE: 'governance/decision/123',
      MODULA_RELEASE_APPROVAL_DECISION_SOURCE: 'GOVERNANCE_DECISION',
    })).toEqual({
      environment: 'production',
      policyId: 'release-policy:v1',
      evidenceReference: 'governance/decision/123',
      decisionSource: 'GOVERNANCE_DECISION',
    })
  })

  it('keeps automated approval test-only and explicitly classified', () => {
    expect(releaseApprovalPolicyFromEnvironment({
      NODE_ENV: 'test',
      MODULA_RELEASE_APPROVAL_POLICY_ID: 'automated-test-policy',
      MODULA_RELEASE_APPROVAL_EVIDENCE_REFERENCE: 'test/run/456',
      MODULA_RELEASE_APPROVAL_DECISION_SOURCE: 'AUTOMATED_TEST_POLICY',
    }).decisionSource).toBe('AUTOMATED_TEST_POLICY')
    expect(() => releaseApprovalPolicyFromEnvironment({
      NODE_ENV: 'production',
      MODULA_RELEASE_APPROVAL_POLICY_ID: 'automated-test-policy',
      MODULA_RELEASE_APPROVAL_EVIDENCE_REFERENCE: 'test/run/456',
      MODULA_RELEASE_APPROVAL_DECISION_SOURCE: 'AUTOMATED_TEST_POLICY',
    })).toThrow(/restricted to NODE_ENV=test/)
  })

  it('requires exact explicit job and candidate digest arguments', () => {
    const jobId = 'prj_00000000-0000-4000-8000-000000000000'
    const candidateSha256 = 'a'.repeat(64)
    expect(releaseApprovalRequestFromArguments([jobId, candidateSha256])).toEqual({jobId, candidateSha256})
    expect(() => releaseApprovalRequestFromArguments([jobId])).toThrow(/Usage/)
    expect(() => releaseApprovalRequestFromArguments([jobId, 'not-a-digest'])).toThrow(/malformed/)
  })
})
