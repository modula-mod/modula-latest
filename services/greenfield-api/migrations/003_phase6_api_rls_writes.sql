-- Phase 6: allow trusted API role to write through FORCE RLS tables.
-- Phase 5 only created public SELECT policies, so authenticated INSERT/UPDATE/DELETE
-- failed with "new row violates row-level security policy".
-- Authorisation remains in the API (session + capabilities + ownership checks).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'posts_api_all' AND tablename = 'posts') THEN
    CREATE POLICY posts_api_all ON posts
      FOR ALL
      TO modula_api
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profiles_api_all' AND tablename = 'profiles') THEN
    CREATE POLICY profiles_api_all ON profiles
      FOR ALL
      TO modula_api
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'post_saves_api_all' AND tablename = 'post_saves') THEN
    CREATE POLICY post_saves_api_all ON post_saves
      FOR ALL
      TO modula_api
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'profile_links_api_all' AND tablename = 'profile_links') THEN
    CREATE POLICY profile_links_api_all ON profile_links
      FOR ALL
      TO modula_api
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO schema_metadata (key, value) VALUES
  ('schema_version', '003')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
