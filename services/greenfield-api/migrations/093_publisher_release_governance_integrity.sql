-- GF-SIGNER-R3A2: catalogue, authorization-audit, revocation and quarantine integrity.
--
-- This migration is forward-only security hardening. It preserves every
-- release, identity, audit event, revocation and quarantine already recorded.
-- New privileged operations are fixed SECURITY DEFINER functions whose caller
-- is bound through greenfield_publisher_release_authority_principals.

-- Extend the closed authority vocabulary without weakening the R3A roles.
DO $$
DECLARE
  constraint_row RECORD;
BEGIN
  FOR constraint_row IN
    SELECT constraint_name.conname
    FROM pg_catalog.pg_constraint AS constraint_name
    WHERE constraint_name.conrelid = 'public.greenfield_publisher_release_authority_principals'::pg_catalog.regclass
      AND constraint_name.contype = 'c'
      AND pg_catalog.pg_get_constraintdef(constraint_name.oid) LIKE '%authority%'
  LOOP
    EXECUTE pg_catalog.format(
      'ALTER TABLE public.greenfield_publisher_release_authority_principals DROP CONSTRAINT %I',
      constraint_row.conname
    );
  END LOOP;
END;
$$;

ALTER TABLE greenfield_publisher_release_authority_principals
  ADD CONSTRAINT greenfield_publisher_release_authority_principals_authority_check CHECK (authority IN (
    'RELEASE_APPROVER',
    'SIGNING_RUNNER',
    'TRUST_VERIFIER',
    'PUBLICATION_AUTHORITY',
    'PUBLISHER_TRUST_AUTHORITY',
    'SIGNING_IDENTITY_AUTHORITY',
    'QUARANTINE_AUTHORITY'
  )),
  ADD CONSTRAINT greenfield_publisher_release_authority_principals_account_check CHECK (
    (authority IN (
      'RELEASE_APPROVER',
      'PUBLICATION_AUTHORITY',
      'PUBLISHER_TRUST_AUTHORITY',
      'SIGNING_IDENTITY_AUTHORITY',
      'QUARANTINE_AUTHORITY'
    )) = (account_id IS NOT NULL)
  );

-- Durable, transaction-specific proof that an identity registration occurred
-- through the fixed authority operation. Ordinary roles have no access.
CREATE TABLE IF NOT EXISTS greenfield_publisher_identity_registration_transitions (
  transition_id TEXT PRIMARY KEY CHECK (transition_id ~ '^psirt_[0-9a-f-]{36}$'),
  identity_id TEXT NOT NULL UNIQUE REFERENCES greenfield_publisher_online_signing_identities(identity_id) ON DELETE RESTRICT,
  signing_key_id TEXT NOT NULL UNIQUE REFERENCES greenfield_publisher_signing_keys(key_id) ON DELETE RESTRICT,
  publisher_id TEXT NOT NULL REFERENCES greenfield_publishers(publisher_id) ON DELETE RESTRICT,
  actor_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE RESTRICT,
  actor_database_role NAME NOT NULL,
  database_transaction_id XID8 NOT NULL,
  audit_event_id TEXT NOT NULL UNIQUE,
  evidence JSONB NOT NULL CHECK (pg_catalog.jsonb_typeof(evidence) = 'object'),
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE OR REPLACE FUNCTION greenfield_signing_identity_insert_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id TEXT;
BEGIN
  actor_id := public.greenfield_publisher_authority_actor('SIGNING_IDENTITY_AUTHORITY');
  IF NEW.created_by_account_id IS DISTINCT FROM actor_id THEN
    RAISE EXCEPTION 'signing identity actor must derive from signing identity authority'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.state <> 'ACTIVE'
     OR NEW.suspended_at IS NOT NULL
     OR NEW.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'a registered signing identity must begin active and unrevoked'
      USING ERRCODE = '42501';
  END IF;
  NEW.created_at := pg_catalog.clock_timestamp();
  NEW.updated_at := NEW.created_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS greenfield_signing_identity_insert_guard
  ON greenfield_publisher_online_signing_identities;
CREATE TRIGGER greenfield_signing_identity_insert_guard
  BEFORE INSERT ON greenfield_publisher_online_signing_identities
  FOR EACH ROW EXECUTE FUNCTION greenfield_signing_identity_insert_guard();

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
  transition_id_value TEXT := 'psirt_' || pg_catalog.gen_random_uuid()::TEXT;
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
    RAISE EXCEPTION 'online signing identity purpose is not permitted'
      USING ERRCODE = '22023';
  END IF;
  IF (requested_purpose = 'MODULA_FIRST_PARTY') IS DISTINCT FROM requested_first_party_authorized THEN
    RAISE EXCEPTION 'first-party signing authority must match the identity purpose'
      USING ERRCODE = '42501';
  END IF;
  IF requested_purpose = 'MODULA_FIRST_PARTY' AND NOT EXISTS (
    SELECT 1
    FROM public.greenfield_publishers AS publisher
    WHERE publisher.publisher_id = requested_publisher_id
      AND publisher.status = 'verified'
      AND publisher.trust_level = 'firstParty'
      AND publisher.revoked_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.greenfield_publisher_namespaces AS namespace
        WHERE namespace.publisher_id = publisher.publisher_id
          AND namespace.verified_at IS NOT NULL
          AND namespace.revoked_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION 'first-party identity registration requires authoritative publisher and namespace facts'
      USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.greenfield_publishers AS publisher
    WHERE publisher.publisher_id = requested_publisher_id
      AND publisher.status = 'verified'
      AND publisher.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'identity registration requires a verified, non-revoked publisher'
      USING ERRCODE = '42501';
  END IF;

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
    pg_catalog.gen_random_uuid()::TEXT, requested_signing_key_id,
    requested_publisher_id, 'registered', NULL, NULL, actor_id, observed_now
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

  evidence_value := pg_catalog.jsonb_build_object(
    'signingKeyId', requested_signing_key_id,
    'provider', requested_provider,
    'purpose', requested_purpose,
    'publicKeyFingerprint', requested_fingerprint,
    'providerKeyVersion', requested_provider_key_version
  );

  INSERT INTO public.greenfield_publisher_identity_registration_transitions (
    transition_id, identity_id, signing_key_id, publisher_id,
    actor_account_id, actor_database_role, database_transaction_id,
    audit_event_id, evidence, occurred_at
  ) VALUES (
    transition_id_value, identity_id_value, requested_signing_key_id,
    requested_publisher_id, actor_id, SESSION_USER::NAME,
    pg_catalog.pg_current_xact_id(), audit_event_id_value, evidence_value,
    observed_now
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

-- This trigger runs before the R3A authenticity trigger (trigger names are
-- ordered alphabetically). It requires the same-transaction transition proof,
-- derives actor/evidence fields, and rejects duplicate state-only events.
CREATE OR REPLACE FUNCTION greenfield_identity_registration_audit_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  transition_row RECORD;
BEGIN
  IF NEW.event_type <> 'identity_registered' THEN
    RETURN NEW;
  END IF;

  SELECT transition.* INTO STRICT transition_row
  FROM public.greenfield_publisher_identity_registration_transitions AS transition
  WHERE transition.audit_event_id = NEW.event_id
    AND transition.identity_id = NEW.identity_id
    AND transition.publisher_id = NEW.publisher_id
    AND transition.database_transaction_id = pg_catalog.pg_current_xact_id()
    AND transition.actor_database_role = SESSION_USER::NAME;

  IF EXISTS (
    SELECT 1
    FROM public.greenfield_publisher_signing_audit_events AS prior
    WHERE prior.identity_id = NEW.identity_id
      AND prior.event_type = 'identity_registered'
  ) THEN
    RAISE EXCEPTION 'identity registration audit event already exists'
      USING ERRCODE = '42501';
  END IF;

  NEW.job_id := NULL;
  NEW.module_id := NULL;
  NEW.actor_account_id := transition_row.actor_account_id;
  NEW.actor_database_role := transition_row.actor_database_role;
  NEW.approval_sha256 := NULL;
  NEW.statement_sha256 := NULL;
  NEW.receipt := '{}'::JSONB;
  NEW.details := transition_row.evidence;
  NEW.created_at := transition_row.occurred_at;
  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'identity registration audit requires its authorized database transition'
      USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS greenfield_identity_registration_audit_guard
  ON greenfield_publisher_signing_audit_events;
CREATE TRIGGER greenfield_identity_registration_audit_guard
  BEFORE INSERT ON greenfield_publisher_signing_audit_events
  FOR EACH ROW EXECUTE FUNCTION greenfield_identity_registration_audit_guard();

-- Quarantine lifecycle evidence is append-only. Existing quarantine rows are
-- preserved; provenance columns are additive and remain nullable for history
-- created before this migration.
ALTER TABLE greenfield_module_quarantines
  ADD COLUMN IF NOT EXISTS created_by_database_role NAME,
  ADD COLUMN IF NOT EXISTS lifted_by_account_id TEXT REFERENCES greenfield_accounts(account_id),
  ADD COLUMN IF NOT EXISTS lifted_by_database_role NAME,
  ADD COLUMN IF NOT EXISTS lift_reason TEXT;

CREATE TABLE IF NOT EXISTS greenfield_module_quarantine_events (
  event_id TEXT PRIMARY KEY CHECK (event_id ~ '^mqe_[0-9a-f-]{36}$'),
  quarantine_id TEXT NOT NULL REFERENCES greenfield_module_quarantines(quarantine_id) ON DELETE RESTRICT,
  release_id TEXT NOT NULL REFERENCES greenfield_module_releases(release_id) ON DELETE RESTRICT,
  event_type TEXT NOT NULL CHECK (event_type IN ('recorded', 'lifted')),
  actor_account_id TEXT REFERENCES greenfield_accounts(account_id) ON DELETE RESTRICT,
  actor_database_role NAME NOT NULL,
  reason TEXT NOT NULL CHECK (pg_catalog.length(pg_catalog.btrim(reason)) BETWEEN 1 AND 500),
  restored_release_state TEXT CHECK (restored_release_state IS NULL OR restored_release_state IN ('pendingReview', 'verified', 'published')),
  database_transaction_id XID8 NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  UNIQUE (quarantine_id, event_type)
);

CREATE OR REPLACE FUNCTION greenfield_module_quarantine_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  RAISE EXCEPTION 'greenfield_module_quarantine_events is append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS greenfield_module_quarantine_events_append_only
  ON greenfield_module_quarantine_events;
CREATE TRIGGER greenfield_module_quarantine_events_append_only
  BEFORE UPDATE OR DELETE ON greenfield_module_quarantine_events
  FOR EACH ROW EXECUTE FUNCTION greenfield_module_quarantine_events_append_only();

CREATE OR REPLACE FUNCTION greenfield_module_quarantine_history_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  lift_event RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reason IS NULL OR pg_catalog.length(pg_catalog.btrim(NEW.reason)) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'quarantine reason must contain 1 to 500 characters'
        USING ERRCODE = '22023';
    END IF;
    NEW.reason := pg_catalog.btrim(NEW.reason);
    NEW.created_at := pg_catalog.clock_timestamp();
    NEW.created_by_database_role := SESSION_USER::NAME;
    NEW.lifted_at := NULL;
    NEW.lifted_by_account_id := NULL;
    NEW.lifted_by_database_role := NULL;
    NEW.lift_reason := NULL;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'quarantine history is immutable'
      USING ERRCODE = '42501';
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
  WHEN NO_DATA_FOUND THEN
    RAISE EXCEPTION 'quarantine lifting requires the fixed quarantine authority operation'
      USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS greenfield_module_quarantine_history_guard
  ON greenfield_module_quarantines;
CREATE TRIGGER greenfield_module_quarantine_history_guard
  BEFORE INSERT OR UPDATE OR DELETE ON greenfield_module_quarantines
  FOR EACH ROW EXECUTE FUNCTION greenfield_module_quarantine_history_guard();

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
    NEW.release_id, 'recorded', NULL, NEW.created_by_database_role,
    NEW.reason, NULL, pg_catalog.pg_current_xact_id(), NEW.created_at
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS greenfield_module_quarantine_record_event
  ON greenfield_module_quarantines;
CREATE TRIGGER greenfield_module_quarantine_record_event
  AFTER INSERT ON greenfield_module_quarantines
  FOR EACH ROW EXECUTE FUNCTION greenfield_module_quarantine_record_event();

CREATE OR REPLACE FUNCTION greenfield_quarantine_authority_lift(
  requested_quarantine_id TEXT,
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
  observed_now TIMESTAMPTZ := pg_catalog.clock_timestamp();
  quarantine_row RECORD;
  release_row RECORD;
  restored_state TEXT;
BEGIN
  actor_id := public.greenfield_publisher_authority_actor('QUARANTINE_AUTHORITY');
  IF clean_reason IS NULL OR pg_catalog.length(clean_reason) NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'quarantine lift reason must contain 1 to 500 characters'
      USING ERRCODE = '22023';
  END IF;

  SELECT quarantine.* INTO STRICT quarantine_row
  FROM public.greenfield_module_quarantines AS quarantine
  WHERE quarantine.quarantine_id = requested_quarantine_id
  FOR UPDATE;
  IF quarantine_row.lifted_at IS NOT NULL THEN
    RAISE EXCEPTION 'quarantine is already lifted' USING ERRCODE = '23505';
  END IF;

  SELECT release.* INTO STRICT release_row
  FROM public.greenfield_module_releases AS release
  WHERE release.release_id = quarantine_row.release_id
  FOR UPDATE;
  IF release_row.release_state <> 'quarantined' THEN
    RAISE EXCEPTION 'only a quarantined release can complete a quarantine lift'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.greenfield_module_revocations AS revocation
    WHERE (revocation.scope = 'release' AND revocation.target_id = release_row.release_id)
       OR (revocation.scope = 'module' AND revocation.target_id = release_row.module_id)
       OR (revocation.scope = 'publisher' AND revocation.target_id = release_row.publisher_id)
       OR (revocation.scope = 'signingKey' AND revocation.target_id = release_row.signature_key_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.greenfield_publisher_signing_keys AS signing_key
    WHERE signing_key.key_id = release_row.signature_key_id
      AND (signing_key.state = 'REVOKED' OR signing_key.revoked_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'revoked release facts prohibit quarantine lifting'
      USING ERRCODE = '42501';
  END IF;

  IF release_row.published_at IS NOT NULL THEN
    restored_state := 'published';
  ELSIF EXISTS (
    SELECT 1
    FROM public.greenfield_module_release_signatures AS signature_row
    WHERE signature_row.release_id = release_row.release_id
      AND signature_row.verification_state = 'verified'
      AND signature_row.verified_at IS NOT NULL
      AND signature_row.revoked_at IS NULL
  ) THEN
    restored_state := 'verified';
  ELSE
    restored_state := 'pendingReview';
  END IF;

  IF restored_state = 'published' AND NOT EXISTS (
    SELECT 1
    FROM public.greenfield_publishers AS publisher
    WHERE publisher.publisher_id = release_row.publisher_id
      AND publisher.status = 'verified'
      AND publisher.revoked_at IS NULL
      AND publisher.trust_level = release_row.trust_level
  ) THEN
    RAISE EXCEPTION 'published release trust facts are no longer valid'
      USING ERRCODE = '42501';
  END IF;
  IF restored_state = 'published'
     AND EXISTS (
       SELECT 1 FROM public.greenfield_module_release_signatures AS signature_row
       WHERE signature_row.release_id = release_row.release_id
     )
     AND NOT EXISTS (
       SELECT 1 FROM public.greenfield_module_release_signatures AS signature_row
       WHERE signature_row.release_id = release_row.release_id
         AND signature_row.verification_state = 'verified'
         AND signature_row.verified_at IS NOT NULL
         AND signature_row.revoked_at IS NULL
     ) THEN
    RAISE EXCEPTION 'published signed release no longer has valid signature evidence'
      USING ERRCODE = '42501';
  END IF;

  -- If another active quarantine remains, record this authorized lift but keep
  -- the release fail-closed until every quarantine is independently lifted.
  IF EXISTS (
    SELECT 1
    FROM public.greenfield_module_quarantines AS other_quarantine
    WHERE other_quarantine.release_id = release_row.release_id
      AND other_quarantine.quarantine_id <> quarantine_row.quarantine_id
      AND other_quarantine.lifted_at IS NULL
  ) THEN
    restored_state := NULL;
  END IF;

  INSERT INTO public.greenfield_module_quarantine_events (
    event_id, quarantine_id, release_id, event_type, actor_account_id,
    actor_database_role, reason, restored_release_state,
    database_transaction_id, created_at
  ) VALUES (
    'mqe_' || pg_catalog.gen_random_uuid()::TEXT, quarantine_row.quarantine_id,
    release_row.release_id, 'lifted', actor_id, SESSION_USER::NAME,
    clean_reason, restored_state, pg_catalog.pg_current_xact_id(), observed_now
  );

  UPDATE public.greenfield_module_quarantines
  SET lifted_at = observed_now,
      lifted_by_account_id = actor_id,
      lifted_by_database_role = SESSION_USER::NAME,
      lift_reason = clean_reason
  WHERE quarantine_id = quarantine_row.quarantine_id;

  IF restored_state IS NOT NULL THEN
    UPDATE public.greenfield_module_releases
    SET release_state = restored_state,
        updated_at = observed_now
    WHERE release_id = release_row.release_id;

    UPDATE public.greenfield_module_versions
    SET status = restored_state,
        updated_at = observed_now
    WHERE module_version_id = release_row.module_version_id;

    UPDATE public.greenfield_extension_versions
    SET status = restored_state
    WHERE extension_version_id = release_row.extension_version_id;

    UPDATE public.greenfield_extensions
    SET status = restored_state,
        updated_at = observed_now
    WHERE extension_id = release_row.extension_id;
  END IF;

  RETURN COALESCE(restored_state, 'quarantined');
END;
$$;

-- Permit exactly the release-state restoration recorded by the quarantine
-- authority in the current transaction. Revoked releases remain terminal.
CREATE OR REPLACE FUNCTION greenfield_publisher_release_immutable_facts_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  authorized_quarantine_lift BOOLEAN := FALSE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF SESSION_USER::TEXT IN ('modula_api', 'modula_worker')
       AND NEW.release_state NOT IN ('draft', 'pendingReview') THEN
      RAISE EXCEPTION 'ordinary services may only create draft or pending-review releases'
        USING ERRCODE = '42501';
    END IF;
    IF NEW.trust_level = 'firstParty' AND NOT EXISTS (
      SELECT 1
      FROM public.greenfield_publishers AS publisher
      WHERE publisher.publisher_id = NEW.publisher_id
        AND publisher.status = 'verified'
        AND publisher.trust_level = 'firstParty'
        AND publisher.revoked_at IS NULL
    ) THEN
      RAISE EXCEPTION 'first-party release trust requires an authoritative first-party publisher'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.release_id IS DISTINCT FROM OLD.release_id
     OR NEW.module_version_id IS DISTINCT FROM OLD.module_version_id
     OR NEW.extension_id IS DISTINCT FROM OLD.extension_id
     OR NEW.extension_version_id IS DISTINCT FROM OLD.extension_version_id
     OR NEW.module_id IS DISTINCT FROM OLD.module_id
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.publisher_id IS DISTINCT FROM OLD.publisher_id
     OR NEW.source_repository IS DISTINCT FROM OLD.source_repository
     OR NEW.source_commit IS DISTINCT FROM OLD.source_commit
     OR NEW.manifest_path IS DISTINCT FROM OLD.manifest_path
     OR NEW.manifest_sha256 IS DISTINCT FROM OLD.manifest_sha256
     OR NEW.release_sha256 IS DISTINCT FROM OLD.release_sha256
     OR NEW.signature_key_id IS DISTINCT FROM OLD.signature_key_id
     OR NEW.signature IS DISTINCT FROM OLD.signature
     OR NEW.compatibility IS DISTINCT FROM OLD.compatibility
     OR NEW.license_status IS DISTINCT FROM OLD.license_status
     OR NEW.trust_level IS DISTINCT FROM OLD.trust_level
     OR NEW.product_kind IS DISTINCT FROM OLD.product_kind
     OR NEW.extension_product IS DISTINCT FROM OLD.extension_product
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'registry release identity, source, artifact and trust facts are immutable'
      USING ERRCODE = '42501';
  END IF;

  IF OLD.release_state = 'quarantined'
     AND NEW.release_state IS DISTINCT FROM OLD.release_state THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.greenfield_module_quarantine_events AS event
      WHERE event.release_id = OLD.release_id
        AND event.event_type = 'lifted'
        AND event.restored_release_state = NEW.release_state
        AND event.database_transaction_id = pg_catalog.pg_current_xact_id()
        AND event.actor_database_role = SESSION_USER::NAME
        AND NOT EXISTS (
          SELECT 1
          FROM public.greenfield_module_quarantines AS active_quarantine
          WHERE active_quarantine.release_id = OLD.release_id
            AND active_quarantine.lifted_at IS NULL
        )
    ) INTO authorized_quarantine_lift;
    IF NOT authorized_quarantine_lift THEN
      RAISE EXCEPTION 'quarantined releases require an authorized, audited lift transition'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  IF OLD.release_state = 'revoked'
     AND NEW.release_state IS DISTINCT FROM OLD.release_state THEN
    RAISE EXCEPTION 'revoked releases cannot be promoted'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.release_state = 'verified'
     AND OLD.release_state <> 'verified'
     AND EXISTS (
       SELECT 1 FROM public.greenfield_module_release_signatures AS signature_row
       WHERE signature_row.release_id = NEW.release_id
     )
     AND NOT authorized_quarantine_lift
     AND NOT public.greenfield_publisher_authority_has('TRUST_VERIFIER') THEN
    RAISE EXCEPTION 'signed release verification requires trust verifier authority'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.release_state = 'published'
     AND OLD.release_state <> 'published'
     AND NOT authorized_quarantine_lift
     AND NOT public.greenfield_publisher_authority_has('PUBLICATION_AUTHORITY') THEN
    RAISE EXCEPTION 'release publication requires publication authority'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Revocation records are append-only and receive database time. Existing rows
-- are left byte-for-byte unchanged.
CREATE OR REPLACE FUNCTION greenfield_module_revocation_history_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reason IS NULL OR pg_catalog.length(pg_catalog.btrim(NEW.reason)) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'revocation reason must contain 1 to 500 characters'
        USING ERRCODE = '22023';
    END IF;
    NEW.reason := pg_catalog.btrim(NEW.reason);
    NEW.created_at := pg_catalog.clock_timestamp();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'revocation history is append-only'
    USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS greenfield_module_revocation_history_guard
  ON greenfield_module_revocations;
CREATE TRIGGER greenfield_module_revocation_history_guard
  BEFORE INSERT OR UPDATE OR DELETE ON greenfield_module_revocations
  FOR EACH ROW EXECUTE FUNCTION greenfield_module_revocation_history_guard();

CREATE OR REPLACE FUNCTION greenfield_signing_key_revocation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.state = 'REVOKED' THEN
    RAISE EXCEPTION 'revoked signing keys are immutable'
      USING ERRCODE = '42501';
  ELSIF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF OLD.state = 'REVOKED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'revoked signing keys cannot be reactivated or rewritten'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.state = 'REVOKED' AND OLD.state <> 'REVOKED' THEN
    IF NEW.revocation_reason IS NULL
       OR pg_catalog.length(pg_catalog.btrim(NEW.revocation_reason)) NOT BETWEEN 1 AND 500 THEN
      RAISE EXCEPTION 'signing key revocation requires a reason'
        USING ERRCODE = '22023';
    END IF;
    NEW.revocation_reason := pg_catalog.btrim(NEW.revocation_reason);
    NEW.revoked_at := pg_catalog.clock_timestamp();
    NEW.updated_at := NEW.revoked_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS greenfield_signing_key_revocation_guard
  ON greenfield_publisher_signing_keys;
CREATE TRIGGER greenfield_signing_key_revocation_guard
  BEFORE UPDATE OR DELETE ON greenfield_publisher_signing_keys
  FOR EACH ROW EXECUTE FUNCTION greenfield_signing_key_revocation_guard();

-- A published projection must exactly match an authoritative published release
-- and its current publisher, signature, revocation and quarantine facts.
-- Unpublished development projections remain usable but cannot acquire active,
-- executable or new trusted status through ordinary SQL.
CREATE OR REPLACE FUNCTION greenfield_registry_publication_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  release_row RECORD;
  publication_projection BOOLEAN;
  privileged_trust BOOLEAN;
  expected_executable BOOLEAN;
BEGIN
  publication_projection := pg_catalog.lower(NEW.catalogue_status) IN ('active', 'published', 'available', 'enabled')
    OR NEW.executable;
  privileged_trust := NEW.trust <> 'untrustedManifest';

  IF TG_OP = 'UPDATE' AND (
    pg_catalog.lower(OLD.catalogue_status) IN ('active', 'published', 'available', 'enabled')
    OR OLD.executable
  ) AND NOT public.greenfield_publisher_authority_has('PUBLICATION_AUTHORITY') THEN
    RAISE EXCEPTION 'existing publication projections require publication authority'
      USING ERRCODE = '42501';
  END IF;

  IF NOT publication_projection THEN
    IF (TG_OP = 'INSERT' AND privileged_trust)
       OR (TG_OP = 'UPDATE' AND NEW.trust IS DISTINCT FROM OLD.trust) THEN
      RAISE EXCEPTION 'unpublished catalogue trust cannot be caller-assigned'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT public.greenfield_publisher_authority_has('PUBLICATION_AUTHORITY') THEN
    RAISE EXCEPTION 'active or executable catalogue projections require publication authority'
      USING ERRCODE = '42501';
  END IF;

  SELECT release.*, module_version.manifest,
         publisher.display_name AS publisher_display_name,
         publisher.status AS publisher_status,
         publisher.trust_level AS publisher_trust_level,
         publisher.revoked_at AS publisher_revoked_at
  INTO STRICT release_row
  FROM public.greenfield_module_releases AS release
  JOIN public.greenfield_module_versions AS module_version
    ON module_version.module_version_id = release.module_version_id
  JOIN public.greenfield_publishers AS publisher
    ON publisher.publisher_id = release.publisher_id
  WHERE release.module_id = NEW.slug
    AND release.version = NEW.version;

  IF release_row.release_state <> 'published'
     OR release_row.published_at IS NULL
     OR release_row.publisher_status <> 'verified'
     OR release_row.publisher_revoked_at IS NOT NULL
     OR release_row.trust_level IS DISTINCT FROM release_row.publisher_trust_level THEN
    RAISE EXCEPTION 'catalogue publication requires authoritative publisher and published release facts'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.greenfield_module_quarantines AS quarantine
    WHERE quarantine.release_id = release_row.release_id
      AND quarantine.lifted_at IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM public.greenfield_module_revocations AS revocation
    WHERE (revocation.scope = 'release' AND revocation.target_id = release_row.release_id)
       OR (revocation.scope = 'module' AND revocation.target_id = release_row.module_id)
       OR (revocation.scope = 'publisher' AND revocation.target_id = release_row.publisher_id)
       OR (revocation.scope = 'signingKey' AND revocation.target_id = release_row.signature_key_id)
  ) OR EXISTS (
    SELECT 1
    FROM public.greenfield_publisher_signing_keys AS signing_key
    WHERE signing_key.key_id = release_row.signature_key_id
      AND (signing_key.state = 'REVOKED' OR signing_key.revoked_at IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'revoked or quarantined release facts cannot create a publication projection'
      USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.greenfield_module_release_signatures AS signature_row
    WHERE signature_row.release_id = release_row.release_id
  ) AND NOT EXISTS (
    SELECT 1 FROM public.greenfield_module_release_signatures AS signature_row
    WHERE signature_row.release_id = release_row.release_id
      AND signature_row.verification_state = 'verified'
      AND signature_row.verified_at IS NOT NULL
      AND signature_row.revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'signed catalogue release requires verified, non-revoked signature evidence'
      USING ERRCODE = '42501';
  END IF;

  expected_executable := release_row.trust_level = 'firstParty'
    AND COALESCE(release_row.manifest #>> '{lifecycle,executionMode}', '') <> 'declarative';
  IF NEW.extension_id IS DISTINCT FROM release_row.module_id
     OR NEW.slug IS DISTINCT FROM release_row.module_id
     OR NEW.kind IS DISTINCT FROM release_row.product_kind
     OR NEW.name IS DISTINCT FROM release_row.manifest ->> 'name'
     OR NEW.description IS DISTINCT FROM release_row.manifest ->> 'description'
     OR NEW.publisher IS DISTINCT FROM release_row.publisher_display_name
     OR NEW.trust IS DISTINCT FROM release_row.trust_level
     OR NEW.permissions IS DISTINCT FROM COALESCE(release_row.manifest -> 'permissions', '[]'::JSONB)
     OR NEW.compatibility IS DISTINCT FROM release_row.compatibility
     OR NEW.manifest IS DISTINCT FROM release_row.manifest
     OR pg_catalog.lower(NEW.catalogue_status) <> 'active'
     OR NEW.executable IS DISTINCT FROM expected_executable
     OR NEW.distribution_model IS DISTINCT FROM 'free'
     OR NEW.entitlement_id IS NOT NULL THEN
    RAISE EXCEPTION 'catalogue projection must derive from the exact authoritative release facts'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
EXCEPTION
  WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN
    RAISE EXCEPTION 'catalogue publication requires one exact authoritative release'
      USING ERRCODE = '42501';
END;
$$;

-- The API retains its schema-092 ability to append non-registration events;
-- the existing authenticity trigger validates those job transitions and the
-- new transition trigger independently rejects every caller-manufactured
-- identity registration event. The worker retains no audit INSERT privilege.
REVOKE UPDATE ON TABLE greenfield_publisher_signing_audit_events FROM modula_api, modula_worker;
REVOKE INSERT ON TABLE greenfield_publisher_signing_audit_events FROM modula_worker;
REVOKE INSERT, UPDATE, DELETE ON TABLE greenfield_publisher_online_signing_identities FROM modula_api, modula_worker;
REVOKE UPDATE, DELETE ON TABLE greenfield_module_revocations FROM modula_api, modula_worker;
REVOKE UPDATE, DELETE ON TABLE greenfield_module_quarantines FROM modula_api, modula_worker;
REVOKE ALL ON TABLE greenfield_publisher_identity_registration_transitions FROM PUBLIC, modula_api, modula_worker;
REVOKE ALL ON TABLE greenfield_module_quarantine_events FROM PUBLIC, modula_api, modula_worker;

REVOKE ALL ON FUNCTION greenfield_signing_identity_insert_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_identity_authority_register(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_identity_registration_audit_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_module_quarantine_events_append_only() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_module_quarantine_history_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_module_quarantine_record_event() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_quarantine_authority_lift(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_module_revocation_history_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION greenfield_signing_key_revocation_guard() FROM PUBLIC;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '093')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = pg_catalog.clock_timestamp();
