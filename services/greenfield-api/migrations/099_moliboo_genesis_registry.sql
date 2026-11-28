-- MOLIBOO-GENESIS-01: the Moliboo Genesis registry.
--
-- A Personal Moliboo is born when a Modula account is created (master doc
-- MOLIBOOS_complete_ecosystem.md §3): a unique, permanent, non-transferable
-- companion identity in the MLB-GEN-[UUID] namespace, with initial digital
-- DNA (§6) and a Certificate of Origin (§4.1, registry MLB-CERT-[UUID]).
--
-- Design rules, all enforced here and in src/domains/moliboo-genesis/:
-- * One companion per account, ever (UNIQUE account_id). Genesis is
--   idempotent; a retry or a second birth attempt returns the same row.
-- * The commercial character and the private companion stay separate even
--   if they share an appearance: character_id is a nullable appearance
--   lineage, unassigned at birth, and is NOT the companion's identity.
-- * The certificate's hash covers IMMUTABLE fields only (certificate
--   registry ID, instance registry ID, instance ID, origin, born), so a
--   name / wardrobe / personality change never invalidates it.
-- * The Ed25519 signature is NULLABLE. It is applied later, when a signing
--   path is available (offline: Andrei's Mac key modula-2026-10-offline-01;
--   online: Vault Transit, currently unconfigured). Nothing here invents a
--   key or claims server-side offline signing works.
-- * Certificates are permanent registry records. The update guard allows
--   exactly one later mutation: applying the signature while unsigned.
--   A marketplace transaction must never transfer private memory,
--   credentials or accounts; nothing in this migration creates a transfer
--   path (transfer_status is pinned to 'non-transferable').

CREATE TABLE greenfield_moliboo_genesis_instances (
  instance_id TEXT PRIMARY KEY CHECK (instance_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  account_id TEXT NOT NULL UNIQUE REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  registry_id TEXT NOT NULL UNIQUE CHECK (registry_id ~ '^MLB-GEN-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  character_id TEXT REFERENCES greenfield_moliboo_characters(character_id) ON DELETE RESTRICT,
  name TEXT CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 80),
  origin TEXT NOT NULL DEFAULT 'Modula Genesis' CHECK (origin = 'Modula Genesis'),
  bond TEXT NOT NULL DEFAULT 'Original' CHECK (bond = 'Original'),
  transfer_status TEXT NOT NULL DEFAULT 'non-transferable' CHECK (transfer_status = 'non-transferable'),
  born_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revealed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_moliboo_genesis_instances_registry_idx
  ON greenfield_moliboo_genesis_instances(registry_id);

-- The companion's identity fields are immutable after birth. Only the
-- user-chosen name, the (nullable) appearance lineage, the reveal stamp
-- and updated_at may change.
CREATE FUNCTION greenfield_moliboo_genesis_instance_guard() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.account_id IS DISTINCT FROM NEW.account_id
    OR OLD.registry_id IS DISTINCT FROM NEW.registry_id
    OR OLD.origin IS DISTINCT FROM NEW.origin
    OR OLD.bond IS DISTINCT FROM NEW.bond
    OR OLD.transfer_status IS DISTINCT FROM NEW.transfer_status
    OR OLD.born_at IS DISTINCT FROM NEW.born_at
    OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Moliboo Genesis instance identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER greenfield_moliboo_genesis_instances_immutable
  BEFORE UPDATE ON greenfield_moliboo_genesis_instances
  FOR EACH ROW EXECUTE FUNCTION greenfield_moliboo_genesis_instance_guard();

CREATE TABLE greenfield_moliboo_genesis_dna (
  instance_id TEXT PRIMARY KEY REFERENCES greenfield_moliboo_genesis_instances(instance_id) ON DELETE CASCADE,
  dna_version INTEGER NOT NULL DEFAULT 1 CHECK (dna_version >= 1),
  dna_seed TEXT NOT NULL CHECK (dna_seed ~ '^[0-9a-f]{64}$'),
  appearance JSONB NOT NULL CHECK (jsonb_typeof(appearance) = 'object'),
  temperament JSONB NOT NULL CHECK (jsonb_typeof(temperament) = 'object'),
  personality JSONB NOT NULL CHECK (jsonb_typeof(personality) = 'object'),
  aptitudes JSONB NOT NULL CHECK (jsonb_typeof(aptitudes) = 'array'),
  lineage JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(lineage) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE greenfield_moliboo_genesis_certificates (
  certificate_id TEXT PRIMARY KEY CHECK (certificate_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  registry_id TEXT NOT NULL UNIQUE CHECK (registry_id ~ '^MLB-CERT-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  instance_id TEXT NOT NULL UNIQUE REFERENCES greenfield_moliboo_genesis_instances(instance_id) ON DELETE CASCADE,
  certificate_type TEXT NOT NULL DEFAULT 'origin' CHECK (certificate_type = 'origin'),
  instance_registry_id TEXT NOT NULL CHECK (instance_registry_id ~ '^MLB-GEN-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  born_at TIMESTAMPTZ NOT NULL,
  origin TEXT NOT NULL DEFAULT 'Modula Genesis' CHECK (origin = 'Modula Genesis'),
  family TEXT NOT NULL DEFAULT 'Unique lineage',
  bond TEXT NOT NULL DEFAULT 'Original' CHECK (bond = 'Original'),
  transfer_status TEXT NOT NULL DEFAULT 'non-transferable' CHECK (transfer_status = 'non-transferable'),
  immutable_hash TEXT NOT NULL CHECK (immutable_hash ~ '^[0-9a-f]{64}$'),
  signature TEXT CHECK (signature IS NULL OR signature ~ '^[A-Za-z0-9_-]{86}$'),
  signature_key_id TEXT REFERENCES greenfield_publisher_signing_keys(key_id) ON DELETE RESTRICT,
  signature_state TEXT NOT NULL DEFAULT 'unsigned' CHECK (signature_state IN ('unsigned', 'signed')),
  issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((signature_state = 'signed') = (signature IS NOT NULL)),
  CHECK ((signature_state = 'signed') = (signature_key_id IS NOT NULL))
);
CREATE INDEX greenfield_moliboo_genesis_certificates_registry_idx
  ON greenfield_moliboo_genesis_certificates(registry_id);

-- A birth certificate is a permanent record. The ONLY permitted update is
-- applying the Ed25519 signature (plus its key id, state, verification
-- stamp and updated_at) while the certificate is still unsigned. Every
-- other change — including re-signing, un-signing, or touching an immutable
-- field — fails closed. Deletion happens only via account deletion
-- (ON DELETE CASCADE from the account); there is no application delete path.
CREATE FUNCTION greenfield_moliboo_genesis_certificate_guard() RETURNS TRIGGER AS $$
DECLARE
  changed_columns TEXT[];
BEGIN
  IF OLD.signature_state = 'signed' THEN
    RAISE EXCEPTION 'Moliboo Genesis certificate is signed and immutable';
  END IF;
  IF NEW.signature_state <> 'signed' THEN
    RAISE EXCEPTION 'Moliboo Genesis certificate update must apply its signature';
  END IF;
  SELECT array_agg(column_name) INTO changed_columns
  FROM (
    SELECT 'certificate_id' AS column_name WHERE OLD.certificate_id IS DISTINCT FROM NEW.certificate_id
    UNION ALL SELECT 'registry_id' WHERE OLD.registry_id IS DISTINCT FROM NEW.registry_id
    UNION ALL SELECT 'instance_id' WHERE OLD.instance_id IS DISTINCT FROM NEW.instance_id
    UNION ALL SELECT 'certificate_type' WHERE OLD.certificate_type IS DISTINCT FROM NEW.certificate_type
    UNION ALL SELECT 'instance_registry_id' WHERE OLD.instance_registry_id IS DISTINCT FROM NEW.instance_registry_id
    UNION ALL SELECT 'born_at' WHERE OLD.born_at IS DISTINCT FROM NEW.born_at
    UNION ALL SELECT 'origin' WHERE OLD.origin IS DISTINCT FROM NEW.origin
    UNION ALL SELECT 'family' WHERE OLD.family IS DISTINCT FROM NEW.family
    UNION ALL SELECT 'bond' WHERE OLD.bond IS DISTINCT FROM NEW.bond
    UNION ALL SELECT 'transfer_status' WHERE OLD.transfer_status IS DISTINCT FROM NEW.transfer_status
    UNION ALL SELECT 'immutable_hash' WHERE OLD.immutable_hash IS DISTINCT FROM NEW.immutable_hash
    UNION ALL SELECT 'issued_at' WHERE OLD.issued_at IS DISTINCT FROM NEW.issued_at
    UNION ALL SELECT 'created_at' WHERE OLD.created_at IS DISTINCT FROM NEW.created_at
  ) AS forbidden;
  IF changed_columns IS NOT NULL THEN
    RAISE EXCEPTION 'Moliboo Genesis certificate fields are immutable: %', array_to_string(changed_columns, ', ');
  END IF;
  IF NEW.signature IS NULL OR NEW.signature_key_id IS NULL THEN
    RAISE EXCEPTION 'Moliboo Genesis certificate signature application requires a signature and key id';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER greenfield_moliboo_genesis_certificates_immutable
  BEFORE UPDATE ON greenfield_moliboo_genesis_certificates
  FOR EACH ROW EXECUTE FUNCTION greenfield_moliboo_genesis_certificate_guard();

REVOKE ALL ON greenfield_moliboo_genesis_instances, greenfield_moliboo_genesis_dna,
  greenfield_moliboo_genesis_certificates FROM PUBLIC, modula_api, modula_worker;
GRANT SELECT ON greenfield_moliboo_genesis_instances, greenfield_moliboo_genesis_dna,
  greenfield_moliboo_genesis_certificates TO modula_worker, modula_backup;
GRANT SELECT, INSERT, UPDATE ON greenfield_moliboo_genesis_instances,
  greenfield_moliboo_genesis_dna, greenfield_moliboo_genesis_certificates TO modula_api;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '099')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
