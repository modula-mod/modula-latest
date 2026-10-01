-- Registry trust pipeline, step 3: record the immutable install descriptor
-- issued with each install plan. Additive only.
ALTER TABLE greenfield_module_install_plans
  ADD COLUMN IF NOT EXISTS install_descriptor JSONB CHECK (install_descriptor IS NULL OR jsonb_typeof(install_descriptor) = 'object'),
  ADD COLUMN IF NOT EXISTS install_descriptor_sha256 TEXT CHECK (install_descriptor_sha256 IS NULL OR install_descriptor_sha256 ~ '^[0-9a-f]{64}$');

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '060')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
