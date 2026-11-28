-- Migration 093 is unreleased but its former down migration silently restored
-- direct API writes to signing identities, revocations and quarantines. That is
-- not a safe downgrade after governance evidence exists.
--
-- Preserve every schema-093 fact and fail closed. Any downgrade requires a
-- separately reviewed forward migration and an explicit maintenance procedure
-- which disables signing/publication, withdraws restricted credentials, backs
-- up all governance history and independently proves the resulting ACLs.
DO $$
BEGIN
  RAISE EXCEPTION 'unsafe automated downgrade of 093 is prohibited; use an explicitly reviewed fail-closed procedure'
    USING ERRCODE = '42501';
END;
$$;
