-- GF-SIGNER-R3A3: signing-key, revocation, quarantine and role-boundary hardening.
--
-- This forward-only migration preserves all historical rows. New governance
-- facts are accepted only through fixed SECURITY DEFINER operations bound to
-- SESSION_USER authority principals. Cryptographic identity facts and their
-- lifecycle evidence are immutable once recorded.

ALTER TABLE greenfield_publisher_release_authority_principals
  DROP CONSTRAINT greenfield_publisher_release_authority_principals_authority_check,
  DROP CONSTRAINT greenfield_publisher_release_authority_principals_account_check;

ALTER TABLE greenfield_publisher_release_authority_principals
  ADD CONSTRAINT greenfield_publisher_release_authority_principals_authority_check CHECK (authority IN (
    'RELEASE_APPROVER',
    'SIGNING_RUNNER',
    'TRUST_VERIFIER',
    'PUBLICATION_AUTHORITY',
    'PUBLISHER_TRUST_AUTHORITY',
    'SIGNING_IDENTITY_AUTHORITY',
    'QUARANTINE_AUTHORITY',
    'REVOCATION_AUTHORITY'
  )),
  ADD CONSTRAINT greenfield_publisher_release_authority_principals_account_check CHECK (
    (authority IN (
      'RELEASE_APPROVER',
      'PUBLICATION_AUTHORITY',
      'PUBLISHER_TRUST_AUTHORITY',
      'SIGNING_IDENTITY_AUTHORITY',
      'QUARANTINE_AUTHORITY',
      'REVOCATION_AUTHORITY'
    )) = (account_id IS NOT NULL)
  );

ALTER TABLE greenfield_module_revocations
  ADD COLUMN IF NOT EXISTS publisher_id TEXT REFERENCES greenfield_publishers(publisher_id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS created_by_database_role NAME;

CREATE TABLE greenfield_publisher_signing_key_lifecycle_transitions (
  transition_id TEXT PRIMARY KEY CHECK (transition_id ~ '^psklt_[0-9a-f-]{36}$'),
  operation_id TEXT NOT NULL CHECK (operation_id ~ '^psklo_[0-9a-f-]{36}$'),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL CHECK (event_type IN ('registered', 'rotated', 'revoked')),
  key_id TEXT NOT NULL,
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id) ON DELETE RESTRICT,
  related_key_id TEXT,
  identity_id TEXT NOT NULL,
  related_identity_id TEXT,
  reason TEXT,
  actor_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE RESTRICT,
  actor_database_role NAME NOT NULL,
  database_transaction_id XID8 NOT NULL,
  public_key_fingerprint TEXT CHECK (public_key_fingerprint IS NULL OR public_key_fingerprint ~ '^sha256:[0-9a-f]{64}$'),
  details JSONB NOT NULL CHECK (pg_catalog.jsonb_typeof(details) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL,
  UNIQUE (key_id, event_type)
);

CREATE TABLE greenfield_publisher_identity_lifecycle_transitions (
  transition_id TEXT PRIMARY KEY CHECK (transition_id ~ '^psilt_[0-9a-f-]{36}$'),
  operation_id TEXT NOT NULL CHECK (operation_id ~ '^psilo_[0-9a-f-]{36}$'),
  audit_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL CHECK (event_type IN ('identity_rotated', 'identity_revoked')),
  identity_id TEXT NOT NULL REFERENCES greenfield_publisher_online_signing_identities(identity_id) ON DELETE RESTRICT,
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id) ON DELETE RESTRICT,
  actor_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE RESTRICT,
  actor_database_role NAME NOT NULL,
  database_transaction_id XID8 NOT NULL,
  details JSONB NOT NULL CHECK (pg_catalog.jsonb_typeof(details) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION greenfield_governance_transition_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION '% is append-only', TG_TABLE_NAME USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER greenfield_signing_key_lifecycle_transitions_append_only
  BEFORE UPDATE OR DELETE ON greenfield_publisher_signing_key_lifecycle_transitions
  FOR EACH ROW EXECUTE FUNCTION greenfield_governance_transition_append_only();

CREATE TRIGGER greenfield_identity_lifecycle_transitions_append_only
  BEFORE UPDATE OR DELETE ON greenfield_publisher_identity_lifecycle_transitions
  FOR EACH ROW EXECUTE FUNCTION greenfield_governance_transition_append_only();

-- The grant installer calls this after removing direct ACLs and installing the
-- exact function grants. It examines PostgreSQL's real membership closure and
-- effective privileges, including privileges inherited through arbitrary
-- intermediate roles. Role names and attributes alone are not acceptance.
CREATE OR REPLACE FUNCTION greenfield_assert_publisher_authority_role_isolation(
  runner_role NAME,
  approver_role NAME,
  trust_verifier_role NAME,
  publication_authority_role NAME,
  publisher_trust_authority_role NAME,
  signing_identity_authority_role NAME,
  quarantine_authority_role NAME,
  revocation_authority_role NAME
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  boundary_roles NAME[] := ARRAY[
    runner_role, approver_role, trust_verifier_role, publication_authority_role,
    publisher_trust_authority_role, signing_identity_authority_role,
    quarantine_authority_role, revocation_authority_role
  ]::NAME[];
  source_role NAME;
  target_role NAME;
  protected_functions TEXT[] := ARRAY[
    'greenfield_signing_runner_claim',
    'greenfield_signing_runner_submit_signature',
    'greenfield_signing_runner_fail',
    'greenfield_release_approver_record',
    'greenfield_release_approver_invalidate',
    'greenfield_trust_verifier_claim',
    'greenfield_trust_verifier_record',
    'greenfield_publication_authority_publish',
    'greenfield_publication_authority_publish_next',
    'greenfield_publisher_trust_authority_set',
    'greenfield_signing_identity_authority_register',
    'greenfield_signing_identity_authority_rotate',
    'greenfield_signing_identity_authority_revoke',
    'greenfield_quarantine_authority_record',
    'greenfield_quarantine_authority_lift',
    'greenfield_revocation_authority_record'
  ];
BEGIN
  IF pg_catalog.cardinality(boundary_roles) <> 8
     OR EXISTS (SELECT 1 FROM pg_catalog.unnest(boundary_roles) AS role_name WHERE role_name IS NULL)
     OR (SELECT pg_catalog.count(DISTINCT role_name) FROM pg_catalog.unnest(boundary_roles) AS role_name) <> 8 THEN
    RAISE EXCEPTION 'all eight signing and governance boundary roles must be distinct'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(boundary_roles) AS role_name
    LEFT JOIN pg_catalog.pg_roles AS role_row ON role_row.rolname = role_name
    WHERE role_row.oid IS NULL
       OR role_row.rolsuper
       OR role_row.rolcreaterole
       OR role_row.rolcreatedb
       OR role_row.rolreplication
       OR role_row.rolbypassrls
  ) THEN
    RAISE EXCEPTION 'boundary roles must exist and remain restricted'
      USING ERRCODE = '42501';
  END IF;

  FOREACH source_role IN ARRAY boundary_roles LOOP
    FOREACH target_role IN ARRAY boundary_roles LOOP
      IF source_role <> target_role
         AND pg_catalog.pg_has_role(source_role, target_role, 'MEMBER') THEN
        RAISE EXCEPTION 'boundary role % can assume incompatible authority role %', source_role, target_role
          USING ERRCODE = '42501';
      END IF;
    END LOOP;
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_roles AS candidate
    CROSS JOIN LATERAL (
      SELECT pg_catalog.count(*) AS authority_count
      FROM pg_catalog.unnest(boundary_roles) AS boundary_role
      WHERE pg_catalog.pg_has_role(candidate.oid, boundary_role, 'MEMBER')
    ) AS memberships
    WHERE NOT candidate.rolsuper
      AND NOT candidate.rolcreaterole
      AND NOT candidate.rolcreatedb
      AND NOT candidate.rolreplication
      AND NOT candidate.rolbypassrls
      AND candidate.rolname <> ALL(boundary_roles)
      AND memberships.authority_count > 0
  ) THEN
    RAISE EXCEPTION 'a non-administrative role can assume a protected governance authority'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(boundary_roles) AS boundary_role
    JOIN pg_catalog.pg_roles AS boundary_row ON boundary_row.rolname = boundary_role
    CROSS JOIN pg_catalog.pg_roles AS inherited_role
    WHERE inherited_role.oid <> boundary_row.oid
      AND pg_catalog.pg_has_role(boundary_row.oid, inherited_role.oid, 'MEMBER')
  ) THEN
    RAISE EXCEPTION 'a boundary role inherits or can assume another PostgreSQL role'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(boundary_roles) AS boundary_role
    CROSS JOIN pg_catalog.pg_class AS relation
    WHERE relation.relnamespace = 'public'::pg_catalog.regnamespace
      AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
      AND (
        pg_catalog.has_table_privilege(boundary_role, relation.oid, 'SELECT')
        OR pg_catalog.has_table_privilege(boundary_role, relation.oid, 'INSERT')
        OR pg_catalog.has_table_privilege(boundary_role, relation.oid, 'UPDATE')
        OR pg_catalog.has_table_privilege(boundary_role, relation.oid, 'DELETE')
        OR pg_catalog.has_table_privilege(boundary_role, relation.oid, 'TRUNCATE')
        OR pg_catalog.has_table_privilege(boundary_role, relation.oid, 'REFERENCES')
        OR pg_catalog.has_table_privilege(boundary_role, relation.oid, 'TRIGGER')
        OR pg_catalog.has_any_column_privilege(boundary_role, relation.oid, 'SELECT')
        OR pg_catalog.has_any_column_privilege(boundary_role, relation.oid, 'INSERT')
        OR pg_catalog.has_any_column_privilege(boundary_role, relation.oid, 'UPDATE')
        OR pg_catalog.has_any_column_privilege(boundary_role, relation.oid, 'REFERENCES')
      )
  ) THEN
    RAISE EXCEPTION 'a boundary role retains effective table or column privileges'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(boundary_roles) AS boundary_role
    CROSS JOIN pg_catalog.pg_class AS sequence_row
    WHERE sequence_row.relnamespace = 'public'::pg_catalog.regnamespace
      AND sequence_row.relkind = 'S'
      AND (
        pg_catalog.has_sequence_privilege(boundary_role, sequence_row.oid, 'USAGE')
        OR pg_catalog.has_sequence_privilege(boundary_role, sequence_row.oid, 'SELECT')
        OR pg_catalog.has_sequence_privilege(boundary_role, sequence_row.oid, 'UPDATE')
      )
  ) OR EXISTS (
    SELECT 1
    FROM pg_catalog.unnest(boundary_roles) AS boundary_role
    WHERE pg_catalog.has_schema_privilege(boundary_role, 'public', 'CREATE')
  ) THEN
    RAISE EXCEPTION 'a boundary role retains effective sequence or schema-creation privileges'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.pronamespace = 'public'::pg_catalog.regnamespace
      AND procedure_row.proname = ANY(protected_functions)
      AND pg_catalog.has_function_privilege('public', procedure_row.oid, 'EXECUTE')
  ) THEN
    RAISE EXCEPTION 'PUBLIC can execute a protected governance function'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    WITH allowed(role_name, function_name) AS (
      VALUES
        (runner_role, 'greenfield_signing_runner_claim'),
        (runner_role, 'greenfield_signing_runner_submit_signature'),
        (runner_role, 'greenfield_signing_runner_fail'),
        (approver_role, 'greenfield_release_approver_record'),
        (approver_role, 'greenfield_release_approver_invalidate'),
        (trust_verifier_role, 'greenfield_trust_verifier_claim'),
        (trust_verifier_role, 'greenfield_trust_verifier_record'),
        (publication_authority_role, 'greenfield_publication_authority_publish_next'),
        (publisher_trust_authority_role, 'greenfield_publisher_trust_authority_set'),
        (signing_identity_authority_role, 'greenfield_signing_identity_authority_register'),
        (signing_identity_authority_role, 'greenfield_signing_identity_authority_rotate'),
        (signing_identity_authority_role, 'greenfield_signing_identity_authority_revoke'),
        (quarantine_authority_role, 'greenfield_quarantine_authority_record'),
        (quarantine_authority_role, 'greenfield_quarantine_authority_lift'),
        (revocation_authority_role, 'greenfield_revocation_authority_record')
    )
    SELECT 1
    FROM pg_catalog.unnest(boundary_roles) AS boundary_role
    CROSS JOIN pg_catalog.pg_proc AS procedure_row
    WHERE procedure_row.pronamespace = 'public'::pg_catalog.regnamespace
      AND procedure_row.proname = ANY(protected_functions)
      AND pg_catalog.has_function_privilege(boundary_role, procedure_row.oid, 'EXECUTE')
      AND NOT EXISTS (
        SELECT 1 FROM allowed
        WHERE allowed.role_name = boundary_role
          AND allowed.function_name = procedure_row.proname
      )
  ) THEN
    RAISE EXCEPTION 'a boundary role can execute an incompatible governance operation'
      USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    WITH required(role_name, function_name) AS (
      VALUES
        (runner_role, 'greenfield_signing_runner_claim'),
        (runner_role, 'greenfield_signing_runner_submit_signature'),
        (runner_role, 'greenfield_signing_runner_fail'),
        (approver_role, 'greenfield_release_approver_record'),
        (approver_role, 'greenfield_release_approver_invalidate'),
        (trust_verifier_role, 'greenfield_trust_verifier_claim'),
        (trust_verifier_role, 'greenfield_trust_verifier_record'),
        (publication_authority_role, 'greenfield_publication_authority_publish_next'),
        (publisher_trust_authority_role, 'greenfield_publisher_trust_authority_set'),
        (signing_identity_authority_role, 'greenfield_signing_identity_authority_register'),
        (signing_identity_authority_role, 'greenfield_signing_identity_authority_rotate'),
        (signing_identity_authority_role, 'greenfield_signing_identity_authority_revoke'),
        (quarantine_authority_role, 'greenfield_quarantine_authority_record'),
        (quarantine_authority_role, 'greenfield_quarantine_authority_lift'),
        (revocation_authority_role, 'greenfield_revocation_authority_record')
    )
    SELECT 1
    FROM required
    WHERE NOT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_proc AS procedure_row
      WHERE procedure_row.pronamespace = 'public'::pg_catalog.regnamespace
        AND procedure_row.proname = required.function_name
        AND pg_catalog.has_function_privilege(required.role_name, procedure_row.oid, 'EXECUTE')
    )
  ) THEN
    RAISE EXCEPTION 'a boundary role is missing its required fixed operation'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION greenfield_signing_key_integrity_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  transition_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'signing key history is immutable' USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT transition.* INTO STRICT transition_row
    FROM public.greenfield_publisher_signing_key_lifecycle_transitions AS transition
    WHERE transition.key_id = NEW.key_id
      AND transition.publisher_id = NEW.publisher_id
      AND transition.identity_id IS NOT NULL
      AND transition.event_type = 'registered'
      AND transition.public_key_fingerprint = NEW.fingerprint
      AND transition.database_transaction_id = pg_catalog.pg_current_xact_id()
      AND transition.actor_database_role = SESSION_USER::NAME;
    IF NEW.algorithm <> 'Ed25519'
       OR NEW.state <> 'ACTIVE'
       OR NEW.rotated_at IS NOT NULL
       OR NEW.rotated_to_key_id IS NOT NULL
       OR NEW.revoked_at IS NOT NULL
       OR NEW.revocation_reason IS NOT NULL THEN
      RAISE EXCEPTION 'registered signing keys must begin as active Ed25519 public facts'
        USING ERRCODE = '42501';
    END IF;
    NEW.registered_by_account_id := transition_row.actor_account_id;
    NEW.created_at := transition_row.occurred_at;
    NEW.updated_at := transition_row.occurred_at;
    RETURN NEW;
  END IF;

  IF OLD.state = 'REVOKED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'revoked signing keys cannot be reactivated or rewritten'
      USING ERRCODE = '42501';
  END IF;
  IF NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;
  IF NEW.key_id IS DISTINCT FROM OLD.key_id
     OR NEW.publisher_id IS DISTINCT FROM OLD.publisher_id
     OR NEW.algorithm IS DISTINCT FROM OLD.algorithm
     OR NEW.public_key_pem IS DISTINCT FROM OLD.public_key_pem
     OR NEW.fingerprint IS DISTINCT FROM OLD.fingerprint
     OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
     OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
     OR NEW.registered_by_account_id IS DISTINCT FROM OLD.registered_by_account_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'signing key cryptographic, identity and registration facts are immutable'
      USING ERRCODE = '42501';
  END IF;

  SELECT transition.* INTO STRICT transition_row
  FROM public.greenfield_publisher_signing_key_lifecycle_transitions AS transition
  WHERE transition.key_id = OLD.key_id
    AND transition.publisher_id = OLD.publisher_id
    AND transition.database_transaction_id = pg_catalog.pg_current_xact_id()
    AND transition.actor_database_role = SESSION_USER::NAME
    AND transition.event_type = CASE WHEN NEW.state = 'ROTATED' THEN 'rotated' ELSE 'revoked' END;

  IF NEW.state = 'ROTATED' THEN
    IF OLD.state <> 'ACTIVE'
       OR transition_row.related_key_id IS NULL
       OR NEW.rotated_to_key_id IS DISTINCT FROM transition_row.related_key_id
       OR NEW.rotated_at IS DISTINCT FROM transition_row.occurred_at
       OR NEW.updated_at IS DISTINCT FROM transition_row.occurred_at
       OR NEW.revoked_at IS DISTINCT FROM OLD.revoked_at
       OR NEW.revocation_reason IS DISTINCT FROM OLD.revocation_reason THEN
      RAISE EXCEPTION 'signing key rotation must derive from its authorized lifecycle transition'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.state = 'REVOKED' THEN
    IF OLD.state NOT IN ('ACTIVE', 'ROTATED')
       OR NEW.revoked_at IS DISTINCT FROM transition_row.occurred_at
       OR NEW.revocation_reason IS DISTINCT FROM transition_row.reason
       OR NEW.updated_at IS DISTINCT FROM transition_row.occurred_at
       OR NEW.rotated_at IS DISTINCT FROM OLD.rotated_at
       OR NEW.rotated_to_key_id IS DISTINCT FROM OLD.rotated_to_key_id THEN
      RAISE EXCEPTION 'signing key revocation must derive from its authorized lifecycle transition'
        USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'unsupported signing key lifecycle transition' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'signing key mutation requires one authorized lifecycle transition'
      USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS greenfield_signing_key_revocation_guard
  ON greenfield_publisher_signing_keys;
DROP TRIGGER IF EXISTS greenfield_signing_key_integrity_guard
  ON greenfield_publisher_signing_keys;
CREATE TRIGGER greenfield_signing_key_integrity_guard
  BEFORE INSERT OR UPDATE OR DELETE ON greenfield_publisher_signing_keys
  FOR EACH ROW EXECUTE FUNCTION greenfield_signing_key_integrity_guard();

CREATE OR REPLACE FUNCTION greenfield_signing_key_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  transition_row RECORD;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'greenfield_publisher_signing_key_events is append-only'
      USING ERRCODE = '42501';
  END IF;
  SELECT transition.* INTO STRICT transition_row
  FROM public.greenfield_publisher_signing_key_lifecycle_transitions AS transition
  WHERE transition.event_id = NEW.event_id
    AND transition.key_id = NEW.key_id
    AND transition.publisher_id = NEW.publisher_id
    AND transition.event_type = NEW.event_type
    AND transition.database_transaction_id = pg_catalog.pg_current_xact_id()
    AND transition.actor_database_role = SESSION_USER::NAME;
  NEW.related_key_id := transition_row.related_key_id;
  NEW.reason := transition_row.reason;
  NEW.actor_account_id := transition_row.actor_account_id;
  NEW.created_at := transition_row.occurred_at;
  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'signing key event requires one authorized lifecycle transition'
      USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS greenfield_signing_key_events_append_only
  ON greenfield_publisher_signing_key_events;
CREATE TRIGGER greenfield_signing_key_events_append_only
  BEFORE INSERT OR UPDATE OR DELETE ON greenfield_publisher_signing_key_events
  FOR EACH ROW EXECUTE FUNCTION greenfield_signing_key_events_append_only();

CREATE OR REPLACE FUNCTION greenfield_signing_identity_insert_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  transition_row RECORD;
BEGIN
  SELECT transition.* INTO STRICT transition_row
  FROM public.greenfield_publisher_signing_key_lifecycle_transitions AS transition
  WHERE transition.identity_id = NEW.identity_id
    AND transition.key_id = NEW.signing_key_id
    AND transition.publisher_id = NEW.publisher_id
    AND transition.event_type = 'registered'
    AND transition.database_transaction_id = pg_catalog.pg_current_xact_id()
    AND transition.actor_database_role = SESSION_USER::NAME;
  IF NEW.created_by_account_id IS DISTINCT FROM transition_row.actor_account_id
     OR NEW.state <> 'ACTIVE'
     OR NEW.suspended_at IS NOT NULL
     OR NEW.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'signing identity registration must derive from signing identity authority'
      USING ERRCODE = '42501';
  END IF;
  NEW.created_at := transition_row.occurred_at;
  NEW.updated_at := transition_row.occurred_at;
  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'signing identity registration requires one authorized key transition'
      USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION greenfield_signing_identity_lifecycle_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  transition_row RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'signing identity history is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW IS NOT DISTINCT FROM OLD THEN
    RETURN NEW;
  END IF;
  IF OLD.state = 'REVOKED' THEN
    RAISE EXCEPTION 'revoked signing identities cannot be reactivated or rewritten'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.identity_id IS DISTINCT FROM OLD.identity_id
     OR NEW.publisher_id IS DISTINCT FROM OLD.publisher_id
     OR NEW.signing_key_id IS DISTINCT FROM OLD.signing_key_id
     OR NEW.provider IS DISTINCT FROM OLD.provider
     OR NEW.provider_key_ref IS DISTINCT FROM OLD.provider_key_ref
     OR NEW.purpose IS DISTINCT FROM OLD.purpose
     OR NEW.first_party_authorized IS DISTINCT FROM OLD.first_party_authorized
     OR NEW.valid_from IS DISTINCT FROM OLD.valid_from
     OR NEW.valid_until IS DISTINCT FROM OLD.valid_until
     OR NEW.created_by_account_id IS DISTINCT FROM OLD.created_by_account_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'signing identity registration and provider-binding facts are immutable'
      USING ERRCODE = '42501';
  END IF;
  SELECT transition.* INTO STRICT transition_row
  FROM public.greenfield_publisher_identity_lifecycle_transitions AS transition
  WHERE transition.identity_id = OLD.identity_id
    AND transition.publisher_id = OLD.publisher_id
    AND transition.event_type = 'identity_revoked'
    AND transition.database_transaction_id = pg_catalog.pg_current_xact_id()
    AND transition.actor_database_role = SESSION_USER::NAME;
  IF NEW.state <> 'REVOKED'
     OR NEW.suspended_at IS NOT NULL
     OR NEW.suspension_reason IS NOT NULL
     OR NEW.revoked_at IS DISTINCT FROM transition_row.occurred_at
     OR NEW.revocation_reason IS DISTINCT FROM transition_row.details ->> 'reason'
     OR NEW.updated_at IS DISTINCT FROM transition_row.occurred_at THEN
    RAISE EXCEPTION 'signing identity revocation must derive from its authorized lifecycle transition'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'signing identity mutation requires one authorized lifecycle transition'
      USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS greenfield_signing_identity_lifecycle_guard
  ON greenfield_publisher_online_signing_identities;
CREATE TRIGGER greenfield_signing_identity_lifecycle_guard
  BEFORE UPDATE OR DELETE ON greenfield_publisher_online_signing_identities
  FOR EACH ROW EXECUTE FUNCTION greenfield_signing_identity_lifecycle_guard();

CREATE OR REPLACE FUNCTION greenfield_identity_lifecycle_audit_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  transition_row RECORD;
BEGIN
  IF NEW.event_type NOT IN ('identity_rotated', 'identity_revoked') THEN
    RETURN NEW;
  END IF;
  SELECT transition.* INTO STRICT transition_row
  FROM public.greenfield_publisher_identity_lifecycle_transitions AS transition
  WHERE transition.audit_event_id = NEW.event_id
    AND transition.identity_id = NEW.identity_id
    AND transition.publisher_id = NEW.publisher_id
    AND transition.event_type = NEW.event_type
    AND transition.database_transaction_id = pg_catalog.pg_current_xact_id()
    AND transition.actor_database_role = SESSION_USER::NAME;
  NEW.job_id := NULL;
  NEW.module_id := NULL;
  NEW.actor_account_id := transition_row.actor_account_id;
  NEW.actor_database_role := transition_row.actor_database_role;
  NEW.approval_sha256 := NULL;
  NEW.statement_sha256 := NULL;
  NEW.receipt := '{}'::JSONB;
  NEW.details := transition_row.details;
  NEW.created_at := transition_row.occurred_at;
  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'signing identity audit requires one authorized lifecycle transition'
      USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS zz_greenfield_identity_lifecycle_audit_guard
  ON greenfield_publisher_signing_audit_events;
CREATE TRIGGER zz_greenfield_identity_lifecycle_audit_guard
  BEFORE INSERT ON greenfield_publisher_signing_audit_events
  FOR EACH ROW EXECUTE FUNCTION greenfield_identity_lifecycle_audit_guard();

-- Registration is replaced in-place so callers retain the schema-093 contract,
-- while key, key-event and identity rows now require the same transaction's
-- durable authority transition.
CREATE OR REPLACE FUNCTION greenfield_signing_identity_authority_register(
  requested_publisher_id TEXT,
  requested_signing_key_id TEXT,
  requested_public_key_pem TEXT,
  requested_fingerprint TEXT,
  requested_provider TEXT,
  requested_provider_key_ref TEXT,
  requested_purpose TEXT,
  requested_first_party_authorized BOOLEAN,
  requested_valid_from TIMESTAMPTZ,
  requested_valid_until TIMESTAMPTZ,
  requested_provider_key_version TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
  identity_id_value TEXT := 'psi_' || pg_catalog.gen_random_uuid()::TEXT;
  registration_transition_id TEXT := 'psirt_' || pg_catalog.gen_random_uuid()::TEXT;
  key_transition_id TEXT := 'psklt_' || pg_catalog.gen_random_uuid()::TEXT;
  operation_id_value TEXT := 'psklo_' || pg_catalog.gen_random_uuid()::TEXT;
  key_event_id TEXT := pg_catalog.gen_random_uuid()::TEXT;
  audit_event_id_value TEXT := 'psae_' || pg_catalog.gen_random_uuid()::TEXT;
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  evidence_value JSONB;
BEGIN
  actor_id := public.greenfield_publisher_authority_actor('SIGNING_IDENTITY_AUTHORITY');
  IF requested_valid_from IS NULL
     OR requested_valid_until IS NULL
     OR requested_valid_until <= requested_valid_from
     OR requested_valid_until > requested_valid_from + INTERVAL '397 days' THEN
    RAISE EXCEPTION 'online signing identity validity must be positive and no longer than 397 days'
      USING ERRCODE = '22023';
  END IF;
  IF requested_purpose NOT IN ('PUBLISHER', 'MODULA_FIRST_PARTY') THEN
    RAISE EXCEPTION 'online signing identity purpose is not permitted' USING ERRCODE = '22023';
  END IF;
  IF (requested_purpose = 'MODULA_FIRST_PARTY') IS DISTINCT FROM requested_first_party_authorized THEN
    RAISE EXCEPTION 'first-party signing authority must match the identity purpose'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.greenfield_publishers AS publisher
    WHERE publisher.publisher_id = requested_publisher_id
      AND publisher.status = 'verified'
      AND publisher.revoked_at IS NULL
      AND (
        requested_purpose <> 'MODULA_FIRST_PARTY'
        OR (
          publisher.trust_level = 'firstParty'
          AND EXISTS (
            SELECT 1 FROM public.greenfield_publisher_namespaces AS namespace
            WHERE namespace.publisher_id = publisher.publisher_id
              AND namespace.verified_at IS NOT NULL
              AND namespace.revoked_at IS NULL
          )
        )
      )
  ) THEN
    RAISE EXCEPTION 'identity registration requires authoritative verified publisher policy'
      USING ERRCODE = '42501';
  END IF;

  evidence_value := pg_catalog.jsonb_build_object(
    'signingKeyId', requested_signing_key_id,
    'provider', requested_provider,
    'providerKeyRef', requested_provider_key_ref,
    'purpose', requested_purpose,
    'firstPartyAuthorized', requested_first_party_authorized,
    'publicKeyFingerprint', requested_fingerprint,
    'providerKeyVersion', requested_provider_key_version
  );
  INSERT INTO public.greenfield_publisher_signing_key_lifecycle_transitions (
    transition_id, operation_id, event_id, event_type, key_id, publisher_id,
    related_key_id, identity_id, related_identity_id, reason,
    actor_account_id, actor_database_role, database_transaction_id,
    public_key_fingerprint, details, occurred_at
  ) VALUES (
    key_transition_id, operation_id_value, key_event_id, 'registered',
    requested_signing_key_id, requested_publisher_id, NULL, identity_id_value,
    NULL, NULL, actor_id, SESSION_USER::NAME, pg_catalog.pg_current_xact_id(),
    requested_fingerprint, evidence_value, observed_now
  );
  INSERT INTO public.greenfield_publisher_signing_keys (
    key_id, publisher_id, algorithm, public_key_pem, fingerprint, state,
    valid_from, valid_until, rotated_at, rotated_to_key_id, revoked_at,
    revocation_reason, registered_by_account_id, created_at, updated_at
  ) VALUES (
    requested_signing_key_id, requested_publisher_id, 'Ed25519', requested_public_key_pem,
    requested_fingerprint, 'ACTIVE', requested_valid_from, requested_valid_until,
    NULL, NULL, NULL, NULL, actor_id, observed_now, observed_now
  );
  INSERT INTO public.greenfield_publisher_signing_key_events (
    event_id, key_id, publisher_id, event_type, related_key_id, reason,
    actor_account_id, created_at
  ) VALUES (
    key_event_id, requested_signing_key_id, requested_publisher_id,
    'registered', NULL, NULL, actor_id, observed_now
  );
  INSERT INTO public.greenfield_publisher_online_signing_identities (
    identity_id, publisher_id, signing_key_id, provider, provider_key_ref,
    purpose, state, first_party_authorized, valid_from, valid_until,
    suspended_at, suspension_reason, revoked_at, revocation_reason,
    created_by_account_id, created_at, updated_at
  ) VALUES (
    identity_id_value, requested_publisher_id, requested_signing_key_id,
    requested_provider, requested_provider_key_ref, requested_purpose, 'ACTIVE',
    requested_first_party_authorized, requested_valid_from, requested_valid_until,
    NULL, NULL, NULL, NULL, actor_id, observed_now, observed_now
  );
  INSERT INTO public.greenfield_publisher_identity_registration_transitions (
    transition_id, identity_id, signing_key_id, publisher_id,
    actor_account_id, actor_database_role, database_transaction_id,
    audit_event_id, evidence, occurred_at
  ) VALUES (
    registration_transition_id, identity_id_value, requested_signing_key_id,
    requested_publisher_id, actor_id, SESSION_USER::NAME,
    pg_catalog.pg_current_xact_id(), audit_event_id_value, evidence_value, observed_now
  );
  INSERT INTO public.greenfield_publisher_signing_audit_events (
    event_id, event_type, job_id, identity_id, publisher_id, module_id,
    actor_account_id, actor_database_role, approval_sha256, statement_sha256,
    receipt, details, created_at
  ) VALUES (
    audit_event_id_value, 'identity_registered', NULL, identity_id_value,
    requested_publisher_id, NULL, actor_id, SESSION_USER::NAME, NULL, NULL,
    '{}'::JSONB, evidence_value, observed_now
  );
  RETURN identity_id_value;
END;
$$;

CREATE OR REPLACE FUNCTION greenfield_signing_identity_authority_rotate(
  requested_identity_id TEXT,
  requested_signing_key_id TEXT,
  requested_public_key_pem TEXT,
  requested_fingerprint TEXT,
  requested_provider_key_ref TEXT,
  requested_valid_from TIMESTAMPTZ,
  requested_valid_until TIMESTAMPTZ,
  requested_provider_key_version TEXT DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
  old_identity RECORD;
  old_key RECORD;
  new_identity_id TEXT := 'psi_' || pg_catalog.gen_random_uuid()::TEXT;
  operation_id_value TEXT := 'psklo_' || pg_catalog.gen_random_uuid()::TEXT;
  identity_operation_id TEXT := 'psilo_' || pg_catalog.gen_random_uuid()::TEXT;
  new_key_event_id TEXT := pg_catalog.gen_random_uuid()::TEXT;
  old_key_event_id TEXT := pg_catalog.gen_random_uuid()::TEXT;
  registration_audit_id TEXT := 'psae_' || pg_catalog.gen_random_uuid()::TEXT;
  revocation_audit_id TEXT := 'psae_' || pg_catalog.gen_random_uuid()::TEXT;
  rotation_audit_id TEXT := 'psae_' || pg_catalog.gen_random_uuid()::TEXT;
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  registration_evidence JSONB;
  revocation_details JSONB;
  rotation_details JSONB;
BEGIN
  actor_id := public.greenfield_publisher_authority_actor('SIGNING_IDENTITY_AUTHORITY');
  IF requested_valid_from IS NULL
     OR requested_valid_until IS NULL
     OR requested_valid_until <= requested_valid_from
     OR requested_valid_until > requested_valid_from + INTERVAL '397 days' THEN
    RAISE EXCEPTION 'rotated signing identity validity must be positive and no longer than 397 days'
      USING ERRCODE = '22023';
  END IF;
  SELECT identity.* INTO STRICT old_identity
  FROM public.greenfield_publisher_online_signing_identities AS identity
  WHERE identity.identity_id = requested_identity_id FOR UPDATE;
  SELECT signing_key.* INTO STRICT old_key
  FROM public.greenfield_publisher_signing_keys AS signing_key
  WHERE signing_key.key_id = old_identity.signing_key_id
    AND signing_key.publisher_id = old_identity.publisher_id FOR UPDATE;
  IF old_identity.state <> 'ACTIVE' OR old_key.state <> 'ACTIVE' OR old_key.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'only an active, non-revoked signing identity can be rotated'
      USING ERRCODE = '42501';
  END IF;

  registration_evidence := pg_catalog.jsonb_build_object(
    'signingKeyId', requested_signing_key_id,
    'previousSigningKeyId', old_key.key_id,
    'provider', old_identity.provider,
    'providerKeyRef', requested_provider_key_ref,
    'purpose', old_identity.purpose,
    'firstPartyAuthorized', old_identity.first_party_authorized,
    'publicKeyFingerprint', requested_fingerprint,
    'providerKeyVersion', requested_provider_key_version
  );
  revocation_details := pg_catalog.jsonb_build_object(
    'reason', 'rotated to identity ' || new_identity_id,
    'signingKeyId', old_key.key_id,
    'replacementIdentityId', new_identity_id,
    'replacementSigningKeyId', requested_signing_key_id
  );
  rotation_details := pg_catalog.jsonb_build_object(
    'previousIdentityId', old_identity.identity_id,
    'identityId', new_identity_id,
    'previousSigningKeyId', old_key.key_id,
    'signingKeyId', requested_signing_key_id,
    'publicKeyFingerprint', requested_fingerprint,
    'providerKeyVersion', requested_provider_key_version
  );

  INSERT INTO public.greenfield_publisher_signing_key_lifecycle_transitions (
    transition_id, operation_id, event_id, event_type, key_id, publisher_id,
    related_key_id, identity_id, related_identity_id, reason,
    actor_account_id, actor_database_role, database_transaction_id,
    public_key_fingerprint, details, occurred_at
  ) VALUES
    ('psklt_' || pg_catalog.gen_random_uuid()::TEXT, operation_id_value,
     new_key_event_id, 'registered', requested_signing_key_id, old_identity.publisher_id,
     old_key.key_id, new_identity_id, old_identity.identity_id, NULL,
     actor_id, SESSION_USER::NAME, pg_catalog.pg_current_xact_id(),
     requested_fingerprint, registration_evidence, observed_now),
    ('psklt_' || pg_catalog.gen_random_uuid()::TEXT, operation_id_value,
     old_key_event_id, 'rotated', old_key.key_id, old_identity.publisher_id,
     requested_signing_key_id, old_identity.identity_id, new_identity_id, NULL,
     actor_id, SESSION_USER::NAME, pg_catalog.pg_current_xact_id(),
     old_key.fingerprint, rotation_details, observed_now);

  INSERT INTO public.greenfield_publisher_signing_keys (
    key_id, publisher_id, algorithm, public_key_pem, fingerprint, state,
    valid_from, valid_until, rotated_at, rotated_to_key_id, revoked_at,
    revocation_reason, registered_by_account_id, created_at, updated_at
  ) VALUES (
    requested_signing_key_id, old_identity.publisher_id, 'Ed25519', requested_public_key_pem,
    requested_fingerprint, 'ACTIVE', requested_valid_from, requested_valid_until,
    NULL, NULL, NULL, NULL, actor_id, observed_now, observed_now
  );
  INSERT INTO public.greenfield_publisher_signing_key_events (
    event_id, key_id, publisher_id, event_type, related_key_id, reason,
    actor_account_id, created_at
  ) VALUES (
    new_key_event_id, requested_signing_key_id, old_identity.publisher_id,
    'registered', old_key.key_id, NULL, actor_id, observed_now
  );

  INSERT INTO public.greenfield_publisher_identity_lifecycle_transitions (
    transition_id, operation_id, audit_event_id, event_type, identity_id,
    publisher_id, actor_account_id, actor_database_role,
    database_transaction_id, details, occurred_at
  ) VALUES (
    'psilt_' || pg_catalog.gen_random_uuid()::TEXT, identity_operation_id,
    revocation_audit_id, 'identity_revoked', old_identity.identity_id,
    old_identity.publisher_id, actor_id, SESSION_USER::NAME,
    pg_catalog.pg_current_xact_id(), revocation_details, observed_now
  );
  UPDATE public.greenfield_publisher_online_signing_identities
  SET state = 'REVOKED', suspended_at = NULL, suspension_reason = NULL,
      revoked_at = observed_now,
      revocation_reason = revocation_details ->> 'reason',
      updated_at = observed_now
  WHERE identity_id = old_identity.identity_id;

  INSERT INTO public.greenfield_publisher_online_signing_identities (
    identity_id, publisher_id, signing_key_id, provider, provider_key_ref,
    purpose, state, first_party_authorized, valid_from, valid_until,
    suspended_at, suspension_reason, revoked_at, revocation_reason,
    created_by_account_id, created_at, updated_at
  ) VALUES (
    new_identity_id, old_identity.publisher_id, requested_signing_key_id,
    old_identity.provider, requested_provider_key_ref, old_identity.purpose, 'ACTIVE',
    old_identity.first_party_authorized, requested_valid_from, requested_valid_until,
    NULL, NULL, NULL, NULL, actor_id, observed_now, observed_now
  );
  INSERT INTO public.greenfield_publisher_identity_registration_transitions (
    transition_id, identity_id, signing_key_id, publisher_id,
    actor_account_id, actor_database_role, database_transaction_id,
    audit_event_id, evidence, occurred_at
  ) VALUES (
    'psirt_' || pg_catalog.gen_random_uuid()::TEXT, new_identity_id,
    requested_signing_key_id, old_identity.publisher_id, actor_id,
    SESSION_USER::NAME, pg_catalog.pg_current_xact_id(),
    registration_audit_id, registration_evidence, observed_now
  );
  INSERT INTO public.greenfield_publisher_signing_audit_events (
    event_id, event_type, identity_id, publisher_id, actor_account_id,
    actor_database_role, receipt, details, created_at
  ) VALUES (
    registration_audit_id, 'identity_registered', new_identity_id,
    old_identity.publisher_id, actor_id, SESSION_USER::NAME,
    '{}'::JSONB, registration_evidence, observed_now
  );

  UPDATE public.greenfield_publisher_signing_keys
  SET state = 'ROTATED', rotated_at = observed_now,
      rotated_to_key_id = requested_signing_key_id, updated_at = observed_now
  WHERE key_id = old_key.key_id;
  INSERT INTO public.greenfield_publisher_signing_key_events (
    event_id, key_id, publisher_id, event_type, related_key_id, reason,
    actor_account_id, created_at
  ) VALUES (
    old_key_event_id, old_key.key_id, old_identity.publisher_id,
    'rotated', requested_signing_key_id, NULL, actor_id, observed_now
  );

  INSERT INTO public.greenfield_publisher_signing_audit_events (
    event_id, event_type, identity_id, publisher_id, actor_account_id,
    actor_database_role, receipt, details, created_at
  ) VALUES (
    revocation_audit_id, 'identity_revoked', old_identity.identity_id,
    old_identity.publisher_id, actor_id, SESSION_USER::NAME,
    '{}'::JSONB, revocation_details, observed_now
  );
  INSERT INTO public.greenfield_publisher_identity_lifecycle_transitions (
    transition_id, operation_id, audit_event_id, event_type, identity_id,
    publisher_id, actor_account_id, actor_database_role,
    database_transaction_id, details, occurred_at
  ) VALUES (
    'psilt_' || pg_catalog.gen_random_uuid()::TEXT, identity_operation_id,
    rotation_audit_id, 'identity_rotated', new_identity_id,
    old_identity.publisher_id, actor_id, SESSION_USER::NAME,
    pg_catalog.pg_current_xact_id(), rotation_details, observed_now
  );
  INSERT INTO public.greenfield_publisher_signing_audit_events (
    event_id, event_type, identity_id, publisher_id, actor_account_id,
    actor_database_role, receipt, details, created_at
  ) VALUES (
    rotation_audit_id, 'identity_rotated', new_identity_id,
    old_identity.publisher_id, actor_id, SESSION_USER::NAME,
    '{}'::JSONB, rotation_details, observed_now
  );
  RETURN new_identity_id;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'signing identity or registered key was not found'
      USING ERRCODE = 'P0002';
END;
$$;

CREATE OR REPLACE FUNCTION greenfield_signing_identity_authority_revoke(
  requested_identity_id TEXT,
  requested_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
  identity_row RECORD;
  key_row RECORD;
  operation_id_value TEXT := 'psklo_' || pg_catalog.gen_random_uuid()::TEXT;
  identity_operation_id TEXT := 'psilo_' || pg_catalog.gen_random_uuid()::TEXT;
  key_event_id TEXT := pg_catalog.gen_random_uuid()::TEXT;
  audit_event_id TEXT := 'psae_' || pg_catalog.gen_random_uuid()::TEXT;
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  clean_reason TEXT := pg_catalog.btrim(requested_reason);
  details_value JSONB;
BEGIN
  actor_id := public.greenfield_publisher_authority_actor('SIGNING_IDENTITY_AUTHORITY');
  IF clean_reason IS NULL OR pg_catalog.length(clean_reason) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'signing identity revocation reason must contain 1 to 500 characters'
      USING ERRCODE = '22023';
  END IF;
  SELECT identity.* INTO STRICT identity_row
  FROM public.greenfield_publisher_online_signing_identities AS identity
  WHERE identity.identity_id = requested_identity_id FOR UPDATE;
  SELECT signing_key.* INTO STRICT key_row
  FROM public.greenfield_publisher_signing_keys AS signing_key
  WHERE signing_key.key_id = identity_row.signing_key_id
    AND signing_key.publisher_id = identity_row.publisher_id FOR UPDATE;
  IF identity_row.state = 'REVOKED' AND key_row.state = 'REVOKED' THEN
    RETURN identity_row.identity_id;
  END IF;
  IF identity_row.state = 'REVOKED' OR key_row.state = 'REVOKED' THEN
    RAISE EXCEPTION 'signing identity and key revocation state is inconsistent'
      USING ERRCODE = '42501';
  END IF;
  details_value := pg_catalog.jsonb_build_object(
    'reason', clean_reason,
    'signingKeyId', key_row.key_id,
    'publicKeyFingerprint', key_row.fingerprint
  );
  INSERT INTO public.greenfield_publisher_signing_key_lifecycle_transitions (
    transition_id, operation_id, event_id, event_type, key_id, publisher_id,
    related_key_id, identity_id, related_identity_id, reason,
    actor_account_id, actor_database_role, database_transaction_id,
    public_key_fingerprint, details, occurred_at
  ) VALUES (
    'psklt_' || pg_catalog.gen_random_uuid()::TEXT, operation_id_value,
    key_event_id, 'revoked', key_row.key_id, key_row.publisher_id,
    NULL, identity_row.identity_id, NULL, clean_reason, actor_id,
    SESSION_USER::NAME, pg_catalog.pg_current_xact_id(), key_row.fingerprint,
    details_value, observed_now
  );
  INSERT INTO public.greenfield_publisher_identity_lifecycle_transitions (
    transition_id, operation_id, audit_event_id, event_type, identity_id,
    publisher_id, actor_account_id, actor_database_role,
    database_transaction_id, details, occurred_at
  ) VALUES (
    'psilt_' || pg_catalog.gen_random_uuid()::TEXT, identity_operation_id,
    audit_event_id, 'identity_revoked', identity_row.identity_id,
    identity_row.publisher_id, actor_id, SESSION_USER::NAME,
    pg_catalog.pg_current_xact_id(), details_value, observed_now
  );
  UPDATE public.greenfield_publisher_signing_keys
  SET state = 'REVOKED', revoked_at = observed_now,
      revocation_reason = clean_reason, updated_at = observed_now
  WHERE key_id = key_row.key_id;
  INSERT INTO public.greenfield_publisher_signing_key_events (
    event_id, key_id, publisher_id, event_type, related_key_id, reason,
    actor_account_id, created_at
  ) VALUES (
    key_event_id, key_row.key_id, key_row.publisher_id, 'revoked',
    NULL, clean_reason, actor_id, observed_now
  );
  UPDATE public.greenfield_publisher_online_signing_identities
  SET state = 'REVOKED', suspended_at = NULL, suspension_reason = NULL,
      revoked_at = observed_now, revocation_reason = clean_reason,
      updated_at = observed_now
  WHERE identity_id = identity_row.identity_id;
  INSERT INTO public.greenfield_module_revocations (
    revocation_id, scope, target_id, publisher_id, reason,
    created_by, created_by_database_role, created_at
  ) VALUES (
    'mr_' || pg_catalog.gen_random_uuid()::TEXT, 'signingKey', key_row.key_id,
    key_row.publisher_id, clean_reason, actor_id, SESSION_USER::NAME, observed_now
  ) ON CONFLICT (scope, target_id) DO NOTHING;
  UPDATE public.greenfield_module_release_signatures
  SET verification_state = 'revokedKey', revoked_at = observed_now,
      verification_detail = 'Signing key revoked: ' || clean_reason
  WHERE signature_key_id = key_row.key_id AND revoked_at IS NULL;
  INSERT INTO public.greenfield_publisher_signing_audit_events (
    event_id, event_type, identity_id, publisher_id, actor_account_id,
    actor_database_role, receipt, details, created_at
  ) VALUES (
    audit_event_id, 'identity_revoked', identity_row.identity_id,
    identity_row.publisher_id, actor_id, SESSION_USER::NAME,
    '{}'::JSONB, details_value, observed_now
  );
  RETURN identity_row.identity_id;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'signing identity or registered key was not found'
      USING ERRCODE = 'P0002';
END;
$$;

CREATE OR REPLACE FUNCTION greenfield_module_revocation_history_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
  expected_publisher_id TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'revocation history is append-only' USING ERRCODE = '42501';
  END IF;
  IF NEW.reason IS NULL OR pg_catalog.length(pg_catalog.btrim(NEW.reason)) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'revocation reason must contain 1 to 500 characters'
      USING ERRCODE = '22023';
  END IF;
  IF NEW.scope = 'signingKey' THEN
    actor_id := public.greenfield_publisher_authority_actor('SIGNING_IDENTITY_AUTHORITY');
    SELECT signing_key.publisher_id INTO STRICT expected_publisher_id
    FROM public.greenfield_publisher_signing_keys AS signing_key
    WHERE signing_key.key_id = NEW.target_id;
  ELSIF NEW.scope = 'release' THEN
    actor_id := public.greenfield_publisher_authority_actor('REVOCATION_AUTHORITY');
    SELECT release.publisher_id INTO STRICT expected_publisher_id
    FROM public.greenfield_module_releases AS release
    WHERE release.release_id = NEW.target_id;
  ELSIF NEW.scope = 'module' THEN
    actor_id := public.greenfield_publisher_authority_actor('REVOCATION_AUTHORITY');
    SELECT pg_catalog.min(module_version.publisher_id) INTO STRICT expected_publisher_id
    FROM public.greenfield_module_versions AS module_version
    WHERE module_version.module_id = NEW.target_id
    HAVING pg_catalog.count(DISTINCT module_version.publisher_id) = 1;
  ELSIF NEW.scope = 'publisher' THEN
    actor_id := public.greenfield_publisher_authority_actor('REVOCATION_AUTHORITY');
    SELECT publisher.publisher_id INTO STRICT expected_publisher_id
    FROM public.greenfield_publishers AS publisher
    WHERE publisher.publisher_id = NEW.target_id;
  ELSE
    RAISE EXCEPTION 'unsupported revocation target type' USING ERRCODE = '22023';
  END IF;
  IF NEW.publisher_id IS DISTINCT FROM expected_publisher_id THEN
    RAISE EXCEPTION 'revocation target does not belong to the authorized publisher'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM actor_id THEN
    RAISE EXCEPTION 'revocation actor must derive from authenticated authority context'
      USING ERRCODE = '42501';
  END IF;
  NEW.reason := pg_catalog.btrim(NEW.reason);
  NEW.created_by := actor_id;
  NEW.created_by_database_role := SESSION_USER::NAME;
  NEW.created_at := pg_catalog.clock_timestamp();
  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'revocation target is not a valid applicable entity'
      USING ERRCODE = '23503';
END;
$$;

CREATE OR REPLACE FUNCTION greenfield_revocation_authority_record(
  requested_scope TEXT,
  requested_target_id TEXT,
  requested_publisher_id TEXT,
  requested_reason TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
  clean_reason TEXT := pg_catalog.btrim(requested_reason);
  existing_row RECORD;
  revocation_id_value TEXT := 'mr_' || pg_catalog.gen_random_uuid()::TEXT;
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  actor_id := public.greenfield_publisher_authority_actor('REVOCATION_AUTHORITY');
  IF requested_scope NOT IN ('release', 'module', 'publisher') THEN
    RAISE EXCEPTION 'unsupported revocation target type; signing keys require signing identity authority'
      USING ERRCODE = '22023';
  END IF;
  IF clean_reason IS NULL OR pg_catalog.length(clean_reason) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'revocation reason must contain 1 to 500 characters'
      USING ERRCODE = '22023';
  END IF;
  SELECT revocation.* INTO existing_row
  FROM public.greenfield_module_revocations AS revocation
  WHERE revocation.scope = requested_scope AND revocation.target_id = requested_target_id;
  IF FOUND THEN
    IF existing_row.publisher_id IS DISTINCT FROM requested_publisher_id
       OR existing_row.created_by IS DISTINCT FROM actor_id
       OR existing_row.reason IS DISTINCT FROM clean_reason THEN
      RAISE EXCEPTION 'revocation already exists with different immutable authority facts'
        USING ERRCODE = '23505';
    END IF;
    RETURN existing_row.revocation_id;
  END IF;
  INSERT INTO public.greenfield_module_revocations (
    revocation_id, scope, target_id, publisher_id, reason,
    created_by, created_by_database_role, created_at
  ) VALUES (
    revocation_id_value, requested_scope, requested_target_id,
    requested_publisher_id, clean_reason, actor_id, SESSION_USER::NAME, observed_now
  );
  IF requested_scope = 'release' THEN
    UPDATE public.greenfield_module_releases
    SET release_state = 'revoked', revoked_at = observed_now, updated_at = observed_now
    WHERE release_id = requested_target_id AND publisher_id = requested_publisher_id;
  ELSIF requested_scope = 'publisher' THEN
    UPDATE public.greenfield_publishers
    SET status = 'revoked', revoked_at = observed_now, updated_at = observed_now
    WHERE publisher_id = requested_target_id;
  END IF;
  RETURN revocation_id_value;
END;
$$;

-- Quarantine creation and lifting now share the same authenticated authority.
CREATE OR REPLACE FUNCTION greenfield_module_quarantine_history_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
  lift_event RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    actor_id := public.greenfield_publisher_authority_actor('QUARANTINE_AUTHORITY');
    IF NEW.reason IS NULL OR pg_catalog.length(pg_catalog.btrim(NEW.reason)) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'quarantine reason must contain 1 to 500 characters'
        USING ERRCODE = '22023';
    END IF;
    IF NEW.created_by IS NOT NULL AND NEW.created_by IS DISTINCT FROM actor_id THEN
      RAISE EXCEPTION 'quarantine actor must derive from authenticated authority context'
        USING ERRCODE = '42501';
    END IF;
    NEW.reason := pg_catalog.btrim(NEW.reason);
    NEW.created_by := actor_id;
    NEW.created_at := pg_catalog.clock_timestamp();
    NEW.created_by_database_role := SESSION_USER::NAME;
    NEW.lifted_at := NULL;
    NEW.lifted_by_account_id := NULL;
    NEW.lifted_by_database_role := NULL;
    NEW.lift_reason := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'quarantine history is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW.quarantine_id IS DISTINCT FROM OLD.quarantine_id
     OR NEW.release_id IS DISTINCT FROM OLD.release_id
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.policy_action IS DISTINCT FROM OLD.policy_action
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.created_by_database_role IS DISTINCT FROM OLD.created_by_database_role
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR OLD.lifted_at IS NOT NULL
     OR NEW.lifted_at IS NULL THEN
    RAISE EXCEPTION 'quarantine origin, reason and lifecycle history are immutable'
      USING ERRCODE = '42501';
  END IF;
  SELECT event.* INTO STRICT lift_event
  FROM public.greenfield_module_quarantine_events AS event
  WHERE event.quarantine_id = OLD.quarantine_id
    AND event.release_id = OLD.release_id
    AND event.event_type = 'lifted'
    AND event.database_transaction_id = pg_catalog.pg_current_xact_id()
    AND event.actor_database_role = SESSION_USER::NAME;
  IF NEW.lifted_at IS DISTINCT FROM lift_event.created_at
     OR NEW.lifted_by_account_id IS DISTINCT FROM lift_event.actor_account_id
     OR NEW.lifted_by_database_role IS DISTINCT FROM lift_event.actor_database_role
     OR NEW.lift_reason IS DISTINCT FROM lift_event.reason THEN
    RAISE EXCEPTION 'quarantine lift facts must derive from the authorized lifecycle transition'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'quarantine mutation requires its fixed authority operation'
      USING ERRCODE = '42501';
END;
$$;

CREATE OR REPLACE FUNCTION greenfield_module_quarantine_record_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  INSERT INTO public.greenfield_module_quarantine_events (
    event_id, quarantine_id, release_id, event_type, actor_account_id,
    actor_database_role, reason, restored_release_state,
    database_transaction_id, created_at
  ) VALUES (
    'mqe_' || pg_catalog.gen_random_uuid()::TEXT, NEW.quarantine_id,
    NEW.release_id, 'recorded', NEW.created_by, NEW.created_by_database_role,
    NEW.reason, NULL, pg_catalog.pg_current_xact_id(), NEW.created_at
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION greenfield_quarantine_authority_record(
  requested_release_id TEXT,
  requested_reason TEXT,
  requested_policy_action TEXT DEFAULT 'block'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
  clean_reason TEXT := pg_catalog.btrim(requested_reason);
  quarantine_id_value TEXT := 'mq_' || pg_catalog.gen_random_uuid()::TEXT;
  release_row RECORD;
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
BEGIN
  actor_id := public.greenfield_publisher_authority_actor('QUARANTINE_AUTHORITY');
  IF clean_reason IS NULL OR pg_catalog.length(clean_reason) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'quarantine reason must contain 1 to 500 characters'
      USING ERRCODE = '22023';
  END IF;
  IF requested_policy_action NOT IN ('warn', 'disableExecutableContributions', 'block') THEN
    RAISE EXCEPTION 'unsupported quarantine policy action' USING ERRCODE = '22023';
  END IF;
  SELECT release.* INTO STRICT release_row
  FROM public.greenfield_module_releases AS release
  WHERE release.release_id = requested_release_id FOR UPDATE;
  IF release_row.release_state = 'revoked' OR EXISTS (
    SELECT 1 FROM public.greenfield_module_revocations AS revocation
    WHERE (revocation.scope = 'release' AND revocation.target_id = release_row.release_id)
       OR (revocation.scope = 'module' AND revocation.target_id = release_row.module_id)
       OR (revocation.scope = 'publisher' AND revocation.target_id = release_row.publisher_id)
       OR (revocation.scope = 'signingKey' AND revocation.target_id = release_row.signature_key_id)
  ) THEN
    RAISE EXCEPTION 'revoked release facts cannot be replaced by quarantine'
      USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.greenfield_module_quarantines (
    quarantine_id, release_id, reason, policy_action,
    created_by, created_at, lifted_at
  ) VALUES (
    quarantine_id_value, requested_release_id, clean_reason,
    requested_policy_action, actor_id, observed_now, NULL
  );
  UPDATE public.greenfield_module_releases
  SET release_state = 'quarantined', quarantined_at = observed_now,
      updated_at = observed_now
  WHERE release_id = requested_release_id;
  RETURN quarantine_id_value;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'quarantine target release was not found' USING ERRCODE = 'P0002';
END;
$$;

-- Remove broad legacy mutation paths. Ordinary services remain read-only over
-- key, revocation and quarantine governance facts.
REVOKE INSERT, UPDATE, DELETE ON TABLE
  greenfield_publisher_signing_keys,
  greenfield_publisher_signing_key_events,
  greenfield_publisher_online_signing_identities,
  greenfield_module_revocations,
  greenfield_module_quarantines
FROM modula_api, modula_worker;

REVOKE ALL ON TABLE
  greenfield_publisher_signing_key_lifecycle_transitions,
  greenfield_publisher_identity_lifecycle_transitions
FROM PUBLIC, modula_api, modula_worker;

REVOKE ALL ON FUNCTION greenfield_governance_transition_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_assert_publisher_authority_role_isolation(
  NAME, NAME, NAME, NAME, NAME, NAME, NAME, NAME
) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_key_integrity_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_key_events_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_identity_insert_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_identity_lifecycle_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_identity_lifecycle_audit_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_identity_authority_register(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_identity_authority_rotate(
  TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_identity_authority_revoke(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_module_revocation_history_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_revocation_authority_record(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_module_quarantine_history_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_module_quarantine_record_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_quarantine_authority_record(TEXT, TEXT, TEXT) FROM PUBLIC;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '094')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = pg_catalog.clock_timestamp();
