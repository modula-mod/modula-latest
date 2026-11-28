-- Migration 099 is forward-only. The Genesis registry holds permanent
-- identity and birth-certificate records: reverting would destroy the
-- companion identity, DNA and certificate of every account born after
-- this migration, with no way to re-derive the same registry IDs.
--
-- A downgrade requires a separately reviewed forward migration and an
-- explicit maintenance procedure with a complete backup of the Genesis
-- registry and independent validation of the result.
DO $$
BEGIN
  RAISE EXCEPTION 'unsafe automated downgrade of 099 is prohibited; use an explicitly reviewed fail-closed procedure'
    USING ERRCODE = '42501';
END;
$$;
