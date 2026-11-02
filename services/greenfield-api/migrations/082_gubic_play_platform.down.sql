DELETE FROM greenfield_premium_capabilities WHERE catalogue_version = 1 AND capability_id IN (
  'gubic_play', 'gubic_publish_free', 'gubic_lobby_size', 'gubic_creator_monetisation',
  'gubic_creator_analytics', 'gubic_studio_team_publishing'
);
DROP TABLE IF EXISTS greenfield_gubic_submissions;
DROP TRIGGER IF EXISTS greenfield_gubic_unlocks_immutable ON greenfield_gubic_achievement_unlocks;
DROP FUNCTION IF EXISTS greenfield_reject_gubic_unlock_mutation();
DROP TABLE IF EXISTS greenfield_gubic_achievement_unlocks;
DROP TABLE IF EXISTS greenfield_gubic_achievements;
DROP TABLE IF EXISTS greenfield_gubic_lobby_members;
DROP TABLE IF EXISTS greenfield_gubic_lobbies;
DROP TABLE IF EXISTS greenfield_gubic_play_sessions;
DROP TABLE IF EXISTS greenfield_gubic_library_items;

UPDATE schema_metadata SET value = '081', updated_at = NOW() WHERE key = 'schema_version';
