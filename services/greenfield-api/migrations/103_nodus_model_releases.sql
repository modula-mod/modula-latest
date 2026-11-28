-- Nodus model releases (model-as-patch pipeline).
--
-- Versioned, signed release registry for the on-device Nodus model, modelled
-- on greenfield_module_releases + greenfield_module_release_signatures.
-- The server is the release registry, not the file host: descriptors,
-- manifests, signatures and publication state live here; model bytes live on
-- the artifact origin (CDN/object storage) and are proxied resumably to the
-- device. No model weights are ever stored in the database.
--
-- Migration number: 103. PR #218 (cloud models) holds 102, so this pipeline
-- renumbered from the design's 102. Sequencing: the ordering guard
-- (scripts/verify-migration-ordering.mjs, GF-SIGN-02) fails on the 096-102
-- gap until 096-102 land in main; that is expected and recorded in the PR.

CREATE TABLE greenfield_nodus_model_releases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform ~ '^[a-z0-9-]{1,32}$'),
  version TEXT NOT NULL CHECK (char_length(version) BETWEEN 1 AND 64),
  release_number INTEGER NOT NULL CHECK (release_number > 0),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'superseded', 'deprecated')),
  descriptor JSONB NOT NULL,
  manifest_sha256 TEXT NOT NULL CHECK (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  origin_url TEXT NOT NULL CHECK (char_length(origin_url) BETWEEN 1 AND 2048),
  published_at TIMESTAMPTZ NULL,
  supersedes_version TEXT NULL CHECK (supersedes_version IS NULL OR char_length(supersedes_version) BETWEEN 1 AND 64),
  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (platform, version)
);

-- At most one published release per platform. Publishing supersedes the
-- previous published row in the same transaction; rows are never deleted.
CREATE UNIQUE INDEX greenfield_nodus_model_releases_one_published_idx
  ON greenfield_nodus_model_releases (platform) WHERE status = 'published';
CREATE INDEX greenfield_nodus_model_releases_platform_number_idx
  ON greenfield_nodus_model_releases (platform, release_number DESC);

CREATE TABLE greenfield_nodus_model_release_signatures (
  signature_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  release_id UUID NOT NULL REFERENCES greenfield_nodus_model_releases(id) ON DELETE RESTRICT,
  signature_key_id TEXT NOT NULL CHECK (signature_key_id ~ '^[A-Za-z0-9._:-]{3,160}$'),
  signature TEXT NOT NULL CHECK (signature ~ '^[A-Za-z0-9_-]{86}$'),
  algorithm TEXT NOT NULL DEFAULT 'Ed25519' CHECK (algorithm = 'Ed25519'),
  statement JSONB NOT NULL,
  statement_sha256 TEXT NOT NULL CHECK (statement_sha256 ~ '^[0-9a-f]{64}$'),
  verification_state TEXT NOT NULL
    CHECK (verification_state IN ('pending', 'verified', 'invalid', 'unknownKey', 'revokedKey')),
  verification_detail TEXT NULL,
  public_key_fingerprint TEXT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX greenfield_nodus_model_release_signatures_release_idx
  ON greenfield_nodus_model_release_signatures (release_id, observed_at DESC);

GRANT SELECT ON greenfield_nodus_model_releases,
  greenfield_nodus_model_release_signatures TO modula_worker, modula_backup;
GRANT SELECT, INSERT, UPDATE ON greenfield_nodus_model_releases,
  greenfield_nodus_model_release_signatures TO modula_api;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '103')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
