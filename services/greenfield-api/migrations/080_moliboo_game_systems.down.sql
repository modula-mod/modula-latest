DROP TABLE IF EXISTS greenfield_moliboo_friendship;
DROP TABLE IF EXISTS greenfield_moliboo_quest_progress;
DROP TABLE IF EXISTS greenfield_moliboo_events;
DROP TABLE IF EXISTS greenfield_moliboo_active_buffs;
DROP TABLE IF EXISTS greenfield_moliboo_equipped;
DROP TABLE IF EXISTS greenfield_moliboo_user_outfits;
DROP TABLE IF EXISTS greenfield_moliboo_inventory;
DROP TABLE IF EXISTS greenfield_moliboo_quests;
DROP TABLE IF EXISTS greenfield_moliboo_skills;
DROP TABLE IF EXISTS greenfield_moliboo_buff_definitions;
DROP TABLE IF EXISTS greenfield_moliboo_outfit_sets;
DROP TABLE IF EXISTS greenfield_moliboo_items;

UPDATE schema_metadata SET value = '079', updated_at = NOW() WHERE key = 'schema_version';
