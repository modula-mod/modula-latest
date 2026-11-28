-- Migration 100 is forward-only. Its seed rows are canonical character
-- definitions referenced by Genesis certificates and by any future pack
-- ingestion for the same character IDs; removing them would orphan those
-- references and destroy the canonical record of the confirmed First-100
-- names. Reverting the seed requires a separately reviewed forward
-- migration, not an automated downgrade.
DO $$
BEGIN
  RAISE EXCEPTION 'unsafe automated downgrade of 100 is prohibited; use an explicitly reviewed fail-closed procedure'
    USING ERRCODE = '42501';
END;
$$;
