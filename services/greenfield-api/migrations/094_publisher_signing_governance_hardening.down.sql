-- GF-SIGNER-R3A3 intentionally has no automated downgrade. Removing migration
-- 094 would restore broad signing-key, revocation and quarantine mutation paths
-- while retaining facts created under the hardened authority model.
--
-- A downgrade requires a separately reviewed forward migration, a protected
-- maintenance window, complete governance/audit backup, disabled signing and
-- publication, explicit credential withdrawal, and independent validation.
DO $$
BEGIN
  RAISE EXCEPTION 'unsafe automated downgrade of 094 is prohibited; use an explicitly reviewed fail-closed procedure'
    USING ERRCODE = '42501';
END;
$$;
