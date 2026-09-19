-- GAI-01 governed intelligence lifecycle, decisions, execution and append-only ledger.

CREATE TABLE intelligence_missions (
  mission_id TEXT PRIMARY KEY,
  owner_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES greenfield_developer_organisations(organisation_id),
  objective TEXT NOT NULL CHECK (char_length(objective) BETWEEN 1 AND 8000),
  status TEXT NOT NULL CHECK (status IN ('draft','planning','awaiting_verification','awaiting_authorization','awaiting_approval','running','completed','failed','cancelled','blocked')),
  correlation_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX intelligence_missions_owner_status_idx ON intelligence_missions(owner_account_id, status, created_at DESC);
CREATE INDEX intelligence_missions_workspace_status_idx ON intelligence_missions(workspace_id, status, created_at DESC) WHERE workspace_id IS NOT NULL;
CREATE INDEX intelligence_missions_correlation_idx ON intelligence_missions(correlation_id);

CREATE TABLE intelligence_plans (
  plan_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES intelligence_missions(mission_id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mission_id, version)
);
CREATE INDEX intelligence_plans_mission_idx ON intelligence_plans(mission_id, version DESC);

CREATE TABLE intelligence_plan_steps (
  step_id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES intelligence_plans(plan_id) ON DELETE CASCADE,
  mission_id TEXT NOT NULL REFERENCES intelligence_missions(mission_id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL CHECK (order_index > 0),
  description TEXT NOT NULL,
  capability TEXT NOT NULL,
  dependencies JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(dependencies) = 'array'),
  state TEXT NOT NULL CHECK (state IN ('pending','ready','authorized','running','completed','failed','blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(plan_id, order_index)
);

CREATE TABLE intelligence_proposals (
  proposal_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES intelligence_missions(mission_id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES intelligence_plans(plan_id) ON DELETE CASCADE,
  step_id TEXT NOT NULL REFERENCES intelligence_plan_steps(step_id) ON DELETE CASCADE,
  module_id TEXT,
  family TEXT NOT NULL,
  capability TEXT NOT NULL,
  action_id TEXT,
  input JSONB NOT NULL CHECK (jsonb_typeof(input) IN ('object','array','string','number','boolean','null')),
  requested_by TEXT NOT NULL CHECK (requested_by = 'gaia'),
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mission_id, proposal_id)
);
CREATE INDEX intelligence_proposals_mission_idx ON intelligence_proposals(mission_id, created_at);
CREATE INDEX intelligence_proposals_capability_idx ON intelligence_proposals(capability, created_at DESC);
CREATE UNIQUE INDEX intelligence_proposals_idempotency_idx ON intelligence_proposals(mission_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE intelligence_evidence (
  evidence_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES intelligence_missions(mission_id) ON DELETE CASCADE,
  proposal_id TEXT REFERENCES intelligence_proposals(proposal_id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('record','document','api','user_input','system','derived')),
  source_id TEXT,
  uri TEXT,
  content_hash TEXT,
  captured_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX intelligence_evidence_mission_idx ON intelligence_evidence(mission_id, created_at);

CREATE TABLE intelligence_aki_decisions (
  decision_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES intelligence_missions(mission_id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL REFERENCES intelligence_proposals(proposal_id) ON DELETE CASCADE,
  verdict TEXT NOT NULL CHECK (verdict IN ('allow','allow_with_conditions','require_approval','deny','abstain')),
  risk TEXT NOT NULL CHECK (risk IN ('read_only','write_reversible','write_irreversible','external_side_effect','privileged','financial','unknown')),
  reversibility TEXT NOT NULL CHECK (reversibility IN ('reversible','compensatable','irreversible')),
  checks JSONB NOT NULL CHECK (jsonb_typeof(checks) = 'array'),
  evidence_state TEXT NOT NULL CHECK (evidence_state IN ('EVIDENCE_PRESENT','NO_EVIDENCE','INSUFFICIENT_EVIDENCE','CONFLICTING_EVIDENCE')),
  conflicts JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(conflicts) = 'array'),
  conditions JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(conditions) = 'array'),
  confidence DOUBLE PRECISION CHECK (confidence IS NULL OR confidence BETWEEN 0 AND 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX intelligence_aki_mission_idx ON intelligence_aki_decisions(mission_id, created_at);
CREATE INDEX intelligence_aki_proposal_idx ON intelligence_aki_decisions(proposal_id, created_at DESC);

CREATE TABLE intelligence_governor_decisions (
  governor_decision_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES intelligence_missions(mission_id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL REFERENCES intelligence_proposals(proposal_id) ON DELETE CASCADE,
  aki_decision_id TEXT NOT NULL REFERENCES intelligence_aki_decisions(decision_id),
  authorization_state TEXT NOT NULL CHECK (authorization_state IN ('autonomous','supervised','human_required','blocked')),
  allowed_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(allowed_capabilities) = 'array'),
  constraints JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(constraints) = 'array'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX intelligence_governor_mission_idx ON intelligence_governor_decisions(mission_id, created_at);
CREATE INDEX intelligence_governor_proposal_idx ON intelligence_governor_decisions(proposal_id, created_at DESC);

CREATE TABLE intelligence_approvals (
  approval_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES intelligence_missions(mission_id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL REFERENCES intelligence_proposals(proposal_id) ON DELETE CASCADE,
  requested_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  resolver_account_id TEXT REFERENCES greenfield_accounts(account_id),
  reason TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  UNIQUE(proposal_id)
);
CREATE INDEX intelligence_approvals_owner_status_idx ON intelligence_approvals(requested_account_id, status, requested_at DESC);
CREATE INDEX intelligence_approvals_mission_idx ON intelligence_approvals(mission_id, requested_at);

CREATE TABLE intelligence_runs (
  execution_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES intelligence_missions(mission_id) ON DELETE CASCADE,
  proposal_id TEXT NOT NULL UNIQUE REFERENCES intelligence_proposals(proposal_id) ON DELETE CASCADE,
  governor_decision_id TEXT NOT NULL REFERENCES intelligence_governor_decisions(governor_decision_id),
  approval_id TEXT REFERENCES intelligence_approvals(approval_id),
  status TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed','blocked')),
  idempotency_key TEXT,
  result JSONB,
  error_code TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(mission_id, proposal_id, idempotency_key)
);
CREATE INDEX intelligence_runs_mission_status_idx ON intelligence_runs(mission_id, status, created_at);
CREATE INDEX intelligence_runs_idempotency_idx ON intelligence_runs(idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE intelligence_run_steps (
  run_step_id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL REFERENCES intelligence_runs(execution_id) ON DELETE CASCADE,
  plan_step_id TEXT NOT NULL REFERENCES intelligence_plan_steps(step_id),
  status TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed','blocked')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_code TEXT,
  UNIQUE(execution_id, plan_step_id)
);

CREATE TABLE intelligence_artifacts (
  artifact_id TEXT PRIMARY KEY,
  mission_id TEXT NOT NULL REFERENCES intelligence_missions(mission_id) ON DELETE CASCADE,
  execution_id TEXT NOT NULL REFERENCES intelligence_runs(execution_id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  media_type TEXT NOT NULL,
  uri TEXT,
  content_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX intelligence_artifacts_mission_idx ON intelligence_artifacts(mission_id, created_at);

CREATE TABLE intelligence_ledger_events (
  event_id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL CHECK (schema_version = '1.0.0'),
  event_type TEXT NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user','gaia','aki','governor','command','runtime','system')),
  actor_id TEXT,
  mission_id TEXT NOT NULL REFERENCES intelligence_missions(mission_id) ON DELETE CASCADE,
  correlation_id TEXT NOT NULL,
  owner_account_id TEXT REFERENCES greenfield_accounts(account_id),
  workspace_id TEXT REFERENCES greenfield_developer_organisations(organisation_id),
  proposal_id TEXT REFERENCES intelligence_proposals(proposal_id),
  aki_decision_id TEXT REFERENCES intelligence_aki_decisions(decision_id),
  governor_decision_id TEXT REFERENCES intelligence_governor_decisions(governor_decision_id),
  approval_id TEXT REFERENCES intelligence_approvals(approval_id),
  execution_id TEXT REFERENCES intelligence_runs(execution_id),
  artifact_id TEXT REFERENCES intelligence_artifacts(artifact_id),
  payload JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object')
);
CREATE INDEX intelligence_ledger_mission_time_idx ON intelligence_ledger_events(mission_id, occurred_at, event_id);
CREATE INDEX intelligence_ledger_owner_time_idx ON intelligence_ledger_events(owner_account_id, occurred_at DESC);
CREATE INDEX intelligence_ledger_correlation_idx ON intelligence_ledger_events(correlation_id, occurred_at);
CREATE INDEX intelligence_ledger_type_time_idx ON intelligence_ledger_events(event_type, occurred_at DESC);

CREATE TABLE intelligence_circuits (
  circuit_id TEXT PRIMARY KEY,
  owner_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  workspace_id TEXT REFERENCES greenfield_developer_organisations(organisation_id),
  name TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('draft','validating','active','deprecated','quarantined')),
  active_revision_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX intelligence_circuits_owner_state_idx ON intelligence_circuits(owner_account_id, state, updated_at DESC);

CREATE TABLE intelligence_circuit_revisions (
  revision_id TEXT PRIMARY KEY,
  circuit_id TEXT NOT NULL REFERENCES intelligence_circuits(circuit_id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  definition JSONB NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  created_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(circuit_id, version)
);
ALTER TABLE intelligence_circuits ADD CONSTRAINT intelligence_circuits_active_revision_fk
  FOREIGN KEY (active_revision_id) REFERENCES intelligence_circuit_revisions(revision_id);

CREATE FUNCTION intelligence_reject_ledger_mutation() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'intelligence ledger is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER intelligence_ledger_append_only
  BEFORE UPDATE OR DELETE ON intelligence_ledger_events
  FOR EACH ROW EXECUTE FUNCTION intelligence_reject_ledger_mutation();

CREATE FUNCTION intelligence_validate_mission_transition() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF (OLD.status = 'draft' AND NEW.status IN ('planning','cancelled')) OR
     (OLD.status = 'planning' AND NEW.status IN ('awaiting_verification','failed','cancelled','blocked')) OR
     (OLD.status = 'awaiting_verification' AND NEW.status IN ('awaiting_authorization','failed','cancelled','blocked')) OR
     (OLD.status = 'awaiting_authorization' AND NEW.status IN ('awaiting_approval','running','failed','cancelled','blocked')) OR
     (OLD.status = 'awaiting_approval' AND NEW.status IN ('running','failed','cancelled','blocked')) OR
     (OLD.status = 'running' AND NEW.status IN ('completed','failed','cancelled','blocked')) THEN RETURN NEW;
  END IF;
  RAISE EXCEPTION 'invalid intelligence mission transition: % -> %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER intelligence_mission_transition_guard
  BEFORE UPDATE OF status ON intelligence_missions
  FOR EACH ROW EXECUTE FUNCTION intelligence_validate_mission_transition();

CREATE FUNCTION intelligence_validate_approval_transition() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  IF OLD.status = 'pending' AND NEW.status IN ('approved','rejected','expired','cancelled') THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'invalid intelligence approval transition: % -> %', OLD.status, NEW.status;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER intelligence_approval_transition_guard
  BEFORE UPDATE OF status ON intelligence_approvals
  FOR EACH ROW EXECUTE FUNCTION intelligence_validate_approval_transition();

GRANT SELECT, INSERT, UPDATE, DELETE ON
  intelligence_missions, intelligence_plans, intelligence_plan_steps, intelligence_proposals,
  intelligence_evidence, intelligence_aki_decisions, intelligence_governor_decisions,
  intelligence_approvals, intelligence_runs, intelligence_run_steps, intelligence_artifacts,
  intelligence_circuits, intelligence_circuit_revisions TO modula_api, modula_worker;
GRANT SELECT, INSERT ON intelligence_ledger_events TO modula_api, modula_worker;
GRANT SELECT ON
  intelligence_missions, intelligence_plans, intelligence_plan_steps, intelligence_proposals,
  intelligence_evidence, intelligence_aki_decisions, intelligence_governor_decisions,
  intelligence_approvals, intelligence_runs, intelligence_run_steps, intelligence_artifacts,
  intelligence_ledger_events, intelligence_circuits, intelligence_circuit_revisions TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '056')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
