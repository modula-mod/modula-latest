-- Roll back the 093 enforcement surface while preserving every durable audit,
-- registration-transition and quarantine-lifecycle record created under it.
-- The additive authority vocabulary, evidence tables and provenance columns are
-- intentionally retained so rollback cannot erase governance history.

DROP TRIGGER IF EXISTS greenfield_identity_registration_audit_guard
  ON greenfield_publisher_signing_audit_events;
DROP FUNCTION IF EXISTS greenfield_identity_registration_audit_guard();

DROP TRIGGER IF EXISTS greenfield_signing_identity_insert_guard
  ON greenfield_publisher_online_signing_identities;
DROP FUNCTION IF EXISTS greenfield_signing_identity_insert_guard();
DROP FUNCTION IF EXISTS greenfield_signing_identity_authority_register(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TIMESTAMPTZ, TIMESTAMPTZ, TEXT
);

DROP TRIGGER IF EXISTS greenfield_module_quarantine_record_event
  ON greenfield_module_quarantines;
DROP FUNCTION IF EXISTS greenfield_module_quarantine_record_event();
DROP TRIGGER IF EXISTS greenfield_module_quarantine_history_guard
  ON greenfield_module_quarantines;
DROP FUNCTION IF EXISTS greenfield_module_quarantine_history_guard();
DROP FUNCTION IF EXISTS greenfield_quarantine_authority_lift(TEXT, TEXT);

DROP TRIGGER IF EXISTS greenfield_module_revocation_history_guard
  ON greenfield_module_revocations;
DROP FUNCTION IF EXISTS greenfield_module_revocation_history_guard();
DROP TRIGGER IF EXISTS greenfield_signing_key_revocation_guard
  ON greenfield_publisher_signing_keys;
DROP FUNCTION IF EXISTS greenfield_signing_key_revocation_guard();

-- Restore the exact R3A release-state guard. The append-only quarantine event
-- table and its own immutable trigger remain in place as retained evidence.
CREATE OR REPLACE FUNCTION greenfield_publisher_release_immutable_facts_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
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
  IF OLD.release_state IN ('quarantined', 'revoked')
     AND NEW.release_state IS DISTINCT FROM OLD.release_state THEN
    RAISE EXCEPTION 'quarantined or revoked releases cannot be promoted'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.release_state = 'verified'
     AND OLD.release_state <> 'verified'
     AND EXISTS (
       SELECT 1 FROM public.greenfield_module_release_signatures AS signature_row
       WHERE signature_row.release_id = NEW.release_id
     )
     AND NOT public.greenfield_publisher_authority_has('TRUST_VERIFIER') THEN
    RAISE EXCEPTION 'signed release verification requires trust verifier authority'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.release_state = 'published'
     AND OLD.release_state <> 'published'
     AND NOT public.greenfield_publisher_authority_has('PUBLICATION_AUTHORITY') THEN
    RAISE EXCEPTION 'release publication requires publication authority'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Restore the exact R3A catalogue guard.
CREATE OR REPLACE FUNCTION greenfield_registry_publication_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.greenfield_module_releases AS release
    WHERE release.module_id = NEW.slug
  ) AND NOT public.greenfield_publisher_authority_has('PUBLICATION_AUTHORITY') THEN
    RAISE EXCEPTION 'module registry publication projection requires publication authority'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

-- Restore the schema-092 service grants. Worker governance DML remains revoked.
GRANT INSERT ON TABLE greenfield_publisher_signing_audit_events TO modula_api;
GRANT INSERT, UPDATE ON TABLE greenfield_publisher_online_signing_identities TO modula_api;
GRANT UPDATE ON TABLE greenfield_module_revocations, greenfield_module_quarantines TO modula_api;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '092')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = pg_catalog.clock_timestamp();
