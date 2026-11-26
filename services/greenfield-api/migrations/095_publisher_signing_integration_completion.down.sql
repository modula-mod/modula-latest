-- The migration is forward-only because reverting to the lookup-then-insert
-- implementation would reintroduce a known concurrency race at the revocation
-- authorization boundary.
DO $$
BEGIN
  RAISE EXCEPTION 'unsafe automated downgrade of 095 is prohibited; use an explicitly reviewed fail-closed procedure'
    USING ERRCODE = '42501';
END;
$$;
