ALTER TABLE greenfield_module_install_plans
  DROP COLUMN IF EXISTS install_descriptor_sha256,
  DROP COLUMN IF EXISTS install_descriptor;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '059')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
