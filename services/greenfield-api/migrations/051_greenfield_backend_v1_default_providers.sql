-- Greenfield Backend V1: account-scoped, manifest-driven default providers.

CREATE TABLE greenfield_account_default_providers (
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  capability_role TEXT NOT NULL CHECK (
    length(capability_role) BETWEEN 3 AND 160
    AND capability_role ~ '^[a-z0-9]+([.-][a-z0-9]+)+$'
  ),
  provider_product_id TEXT NOT NULL,
  provider_installation_id TEXT NOT NULL REFERENCES greenfield_extension_installations(installation_id) ON DELETE CASCADE,
  selected_by_account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id),
  selected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, capability_role)
);

CREATE INDEX greenfield_account_default_providers_product_idx
  ON greenfield_account_default_providers(provider_product_id, capability_role);

CREATE FUNCTION greenfield_default_provider_scope_guard()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM greenfield_extension_installations installation
    JOIN greenfield_module_releases release
      ON release.extension_version_id = installation.extension_version_id
    WHERE installation.installation_id = NEW.provider_installation_id
      AND installation.account_id = NEW.account_id
      AND release.module_id = NEW.provider_product_id
      AND release.release_state = 'published'
  ) THEN
    RAISE EXCEPTION 'default provider is outside the account, product or published release scope'
      USING ERRCODE = '23514';
  END IF;
  IF NEW.selected_by_account_id <> NEW.account_id THEN
    RAISE EXCEPTION 'default provider selector must own the account preference'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER greenfield_default_provider_scope_guard_trigger
  BEFORE INSERT OR UPDATE ON greenfield_account_default_providers
  FOR EACH ROW EXECUTE FUNCTION greenfield_default_provider_scope_guard();

GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_account_default_providers TO modula_api, modula_worker;
GRANT SELECT ON greenfield_account_default_providers TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '051')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
