DROP POLICY IF EXISTS posts_api_all ON posts;
DROP POLICY IF EXISTS profiles_api_all ON profiles;
DROP POLICY IF EXISTS post_saves_api_all ON post_saves;
DROP POLICY IF EXISTS profile_links_api_all ON profile_links;

INSERT INTO schema_metadata (key, value) VALUES
  ('schema_version', '002')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
