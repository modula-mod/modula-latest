import {readFileSync} from 'node:fs'
import {describe, expect, it} from 'vitest'

const migration = readFileSync(new URL('../migrations/056_gai01_governed_intelligence.sql', import.meta.url), 'utf8')
const routes = readFileSync(new URL('../src/intelligence/routes.ts', import.meta.url), 'utf8')
const boundary = readFileSync(new URL('../src/intelligence/action-boundary.ts', import.meta.url), 'utf8')

describe('GAI-01 database contract', () => {
  it('uses normalized lifecycle tables with ownership and foreign keys', () => {
    for (const table of [
      'intelligence_missions', 'intelligence_plans', 'intelligence_plan_steps', 'intelligence_proposals',
      'intelligence_aki_decisions', 'intelligence_governor_decisions', 'intelligence_approvals',
      'intelligence_runs', 'intelligence_run_steps', 'intelligence_artifacts', 'intelligence_evidence',
      'intelligence_ledger_events', 'intelligence_circuits', 'intelligence_circuit_revisions',
    ]) expect(migration).toContain(`CREATE TABLE ${table}`)
    expect(migration).toContain('owner_account_id TEXT NOT NULL REFERENCES greenfield_accounts')
    expect(migration).toContain('proposal_id TEXT NOT NULL UNIQUE REFERENCES intelligence_proposals')
    expect(migration).toContain('UNIQUE(mission_id, proposal_id, idempotency_key)')
  })

  it('makes the ledger append-only and guards lifecycle transitions in PostgreSQL', () => {
    expect(migration).toContain('intelligence_reject_ledger_mutation')
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON intelligence_ledger_events')
    expect(migration).toContain('intelligence_validate_mission_transition')
    expect(migration).toContain('intelligence_validate_approval_transition')
  })

  it('indexes owner, workspace, mission, proposal, approval, correlation, status, type and idempotency access paths', () => {
    for (const fragment of ['owner_status_idx', 'workspace_status_idx', 'mission_idx', 'proposal_idx', 'approvals_owner_status_idx', 'ledger_correlation_idx', 'ledger_type_time_idx', 'idempotency_idx']) {
      expect(migration).toContain(fragment)
    }
  })
})

describe('GAI-01 authenticated API and runtime boundary', () => {
  it('declares the stable mission, ledger, evidence, decision, approval and execution routes', () => {
    for (const path of [
      "'/v1/intelligence/missions'",
      "'/v1/intelligence/missions/:missionId'",
      "'/v1/intelligence/missions/:missionId/start'",
      "'/v1/intelligence/missions/:missionId/ledger'",
      "'/v1/intelligence/missions/:missionId/evidence'",
      "'/v1/intelligence/missions/:missionId/decisions'",
      "'/v1/intelligence/missions/:missionId/approvals'",
      "'/v1/intelligence/missions/:missionId/approvals/:approvalId/approve'",
      "'/v1/intelligence/missions/:missionId/approvals/:approvalId/reject'",
      "'/v1/intelligence/missions/:missionId/proposals/:proposalId/execute'",
    ]) expect(routes).toContain(path)
    expect(routes.match(/requireGreenfieldAuth\(request, reply, sessions\)/g)?.length).toBeGreaterThanOrEqual(10)
  })

  it('crosses only the registered Modula record runtime and exposes no arbitrary executor', () => {
    expect(boundary).toContain('GreenfieldModuleRecordService')
    expect(boundary).toContain('this.records.list')
    expect(boundary).toContain('this.records.create')
    expect(boundary).not.toMatch(/\beval\s*\(|new Function|child_process|execFile|spawn\s*\(|raw SQL|ssh/i)
  })
})
