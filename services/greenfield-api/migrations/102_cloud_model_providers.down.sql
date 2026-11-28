-- 102_cloud_model_providers (down)
--
-- The migration is forward-only because reverting would drop the
-- per-account cloud preferences table and delete the Gemini provider and
-- model seed rows after account opt-in, routing and budget data may already
-- exist. An automated downgrade would silently destroy that data and leave
-- accounts pointing at providers the registry no longer knows.
DO $$
BEGIN
  RAISE EXCEPTION 'unsafe automated downgrade of 102 is prohibited; use an explicitly reviewed fail-closed procedure'
    USING ERRCODE = '42501';
END;
$$;
