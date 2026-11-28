-- The migration is forward-only because reverting would discard release
-- registry rows and signature evidence. Use an explicitly reviewed
-- fail-closed procedure (backup/restore) instead of an automated downgrade.
DO $$
BEGIN
  RAISE EXCEPTION 'unsafe automated downgrade of 103 is prohibited; use an explicitly reviewed fail-closed procedure'
    USING ERRCODE = '42501';
END;
$$;
