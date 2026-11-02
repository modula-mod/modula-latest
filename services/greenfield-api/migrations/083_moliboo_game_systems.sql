-- MOLIBOO-GAME-SYSTEMS-01: items catalogue, inventory, outfits (curated sets +
-- user-saved loadouts), equipped looks, signature skills, timed buffs, quests
-- and achievements. All ownership/progress is server-authoritative. Catalogue
-- rows are cosmetic only: no item, skill or buff changes competitive outcomes.
-- Generated catalogue seed: docs/moliboo/game-catalogue.v1.json (version 1).

CREATE TABLE greenfield_moliboo_items (
  item_id TEXT PRIMARY KEY CHECK (item_id ~ '^moliboo\.item\.[a-z0-9_]+$'),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  slot TEXT NOT NULL CHECK (slot IN ('headwear','hair','face','top','outerwear','bottom','footwear','back','handheld','aura')),
  rarity TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  access TEXT NOT NULL CHECK (access IN ('free','earnable','premium')),
  family TEXT,
  set_id TEXT,
  icon_key TEXT NOT NULL,
  palette JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(palette) = 'array'),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_moliboo_items_slot_idx ON greenfield_moliboo_items(slot, sort_order);

CREATE TABLE greenfield_moliboo_outfit_sets (
  set_id TEXT PRIMARY KEY CHECK (set_id ~ '^moliboo\.outfit\.[a-z0-9_]+$'),
  name TEXT NOT NULL,
  family TEXT,
  access TEXT NOT NULL CHECK (access IN ('free','earnable','premium')),
  rarity TEXT NOT NULL CHECK (rarity IN ('common','uncommon','rare','epic','legendary')),
  item_ids JSONB NOT NULL CHECK (jsonb_typeof(item_ids) = 'array' AND jsonb_array_length(item_ids) BETWEEN 2 AND 10),
  icon_key TEXT NOT NULL,
  set_bonus_buff_id TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE greenfield_moliboo_buff_definitions (
  buff_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_seconds INTEGER CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 60 AND 604800),
  stack_rule TEXT NOT NULL CHECK (stack_rule IN ('refresh','stack','while_equipped')),
  max_stacks INTEGER NOT NULL DEFAULT 1 CHECK (max_stacks BETWEEN 1 AND 5),
  exclusive_group TEXT,
  effects JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(effects) = 'object')
);

CREATE TABLE greenfield_moliboo_skills (
  skill_id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL UNIQUE,
  family TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  cooldown_seconds INTEGER NOT NULL CHECK (cooldown_seconds BETWEEN 60 AND 86400),
  grants_buff_id TEXT REFERENCES greenfield_moliboo_buff_definitions(buff_id)
);

CREATE TABLE greenfield_moliboo_quests (
  quest_id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('daily','weekly','achievement','collection')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('care','skill_use','equip','outfit_saved','activity_complete')),
  family_filter TEXT,
  target INTEGER NOT NULL CHECK (target BETWEEN 1 AND 1000),
  reward JSONB NOT NULL CHECK (jsonb_typeof(reward) = 'object'),
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE
);

-- Ownership. Free items are usable by everyone and are never written here;
-- rows exist only for evidence-backed grants (quest, achievement, premium
-- entitlement, admin grant). Never fabricated client-side.
CREATE TABLE greenfield_moliboo_inventory (
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES greenfield_moliboo_items(item_id),
  source TEXT NOT NULL CHECK (source IN ('quest','achievement','collection','premium_entitlement','admin_grant','gift')),
  source_ref TEXT NOT NULL,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  PRIMARY KEY (account_id, item_id)
);

CREATE TABLE greenfield_moliboo_user_outfits (
  outfit_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  character_id TEXT,
  item_ids JSONB NOT NULL CHECK (jsonb_typeof(item_ids) = 'array'),
  revision INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_moliboo_user_outfits_account_idx ON greenfield_moliboo_user_outfits(account_id, updated_at DESC);

CREATE TABLE greenfield_moliboo_equipped (
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  character_id TEXT NOT NULL CHECK (character_id ~ '^moliboo\.[a-z0-9_]+\.[a-z0-9_]+$'),
  item_ids JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(item_ids) = 'array'),
  source_set_id TEXT,
  source_outfit_id TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, character_id)
);

CREATE TABLE greenfield_moliboo_active_buffs (
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  character_id TEXT NOT NULL,
  buff_id TEXT NOT NULL REFERENCES greenfield_moliboo_buff_definitions(buff_id),
  stacks INTEGER NOT NULL DEFAULT 1 CHECK (stacks BETWEEN 1 AND 5),
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (account_id, character_id, buff_id)
);

-- Append-only, idempotent event log feeding quests/achievements.
CREATE TABLE greenfield_moliboo_events (
  event_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  character_id TEXT,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  idempotency_key TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (account_id, idempotency_key)
);
CREATE INDEX greenfield_moliboo_events_account_idx ON greenfield_moliboo_events(account_id, event_type, occurred_at DESC);

CREATE TABLE greenfield_moliboo_quest_progress (
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  quest_id TEXT NOT NULL REFERENCES greenfield_moliboo_quests(quest_id),
  period_key TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  reward_grant JSONB,
  PRIMARY KEY (account_id, quest_id, period_key)
);

CREATE TABLE greenfield_moliboo_friendship (
  account_id TEXT NOT NULL REFERENCES greenfield_accounts(account_id) ON DELETE CASCADE,
  character_id TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (account_id, character_id)
);

INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.well_fed','Well Fed','Your Moliboo is content after a snack.',10800,'refresh',1,NULL,'{"fx": "cheek_glow", "friendshipXpBonusPct": 10, "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.playful','Playful','Bouncy and ready for mini-games.',7200,'stack',3,NULL,'{"fx": "bounce_sparkle", "friendshipXpBonusPct": 5, "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.well_rested','Well Rested','A good nap; calm idle animations.',21600,'refresh',1,'mood','{"fx": "calm_idle", "friendshipXpBonusPct": 10, "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.fresh_groomed','Freshly Groomed','Shiny and fluffy.',14400,'refresh',1,NULL,'{"fx": "shine", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.chatty','Chatty','Enjoyed a chat with you.',7200,'stack',2,'mood','{"fx": "speech_hearts", "friendshipXpBonusPct": 5, "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.signature_angels','Angels Signature Glow','Afterglow from a signature skill.',2700,'refresh',1,'signature','{"fx": "signature_angels", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.signature_underground','Underground Signature Glow','Afterglow from a signature skill.',2700,'refresh',1,'signature','{"fx": "signature_underground", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.signature_enchanted','Enchanted Signature Glow','Afterglow from a signature skill.',2700,'refresh',1,'signature','{"fx": "signature_enchanted", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.signature_stardust','Stardust Signature Glow','Afterglow from a signature skill.',2700,'refresh',1,'signature','{"fx": "signature_stardust", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.signature_dreamers','Dreamers Signature Glow','Afterglow from a signature skill.',2700,'refresh',1,'signature','{"fx": "signature_dreamers", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_halo_choir','Halo Choir set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_halo_choir", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_sunrise_herald','Sunrise Herald set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_sunrise_herald", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_celestial_guardian','Celestial Guardian set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_celestial_guardian", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_neon_skater','Neon Skater set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_neon_skater", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_beat_crew','Beat Crew set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_beat_crew", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_holo_runner','Holo Runner set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_holo_runner", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_mossy_ranger','Mossy Ranger set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_mossy_ranger", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_berry_bard','Berry Bard set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_berry_bard", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_elder_grove','Elder Grove set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_elder_grove", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_comet_cadet','Comet Cadet set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_comet_cadet", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_constellation_scout','Constellation Scout set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_constellation_scout", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_aurora_navigator','Aurora Navigator set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_aurora_navigator", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_sleepy_star','Sleepy Star set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_sleepy_star", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_lullaby_lantern','Lullaby Lantern set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_lullaby_lantern", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_buff_definitions VALUES ('moliboo.buff.set_dream_keeper','Dream Keeper set glow','Active while the complete set is equipped.',NULL,'while_equipped',1,'set','{"fx": "set_dream_keeper", "capPct": 25}'::jsonb);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.halo_ring','Halo Ring','headwear','common','free','angels','moliboo.outfit.halo_choir','item_halo_ring','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,0);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.cloud_curls','Cloud Curls','hair','common','free','angels','moliboo.outfit.halo_choir','item_cloud_curls','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,1);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.pearl_tunic','Pearl Tunic','top','common','free','angels','moliboo.outfit.halo_choir','item_pearl_tunic','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,2);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.feather_wings','Feather Wings','back','common','free','angels','moliboo.outfit.halo_choir','item_feather_wings','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,3);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.soft_glow','Soft Glow','aura','common','free','angels','moliboo.outfit.halo_choir','item_soft_glow','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,4);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.sunray_crown','Sunray Crown','headwear','rare','earnable','angels','moliboo.outfit.sunrise_herald','item_sunray_crown','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,5);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.golden_sweep','Golden Sweep','hair','rare','earnable','angels','moliboo.outfit.sunrise_herald','item_golden_sweep','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,6);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.dawn_cape_top','Dawn Cape Top','top','rare','earnable','angels','moliboo.outfit.sunrise_herald','item_dawn_cape_top','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,7);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.little_trumpet','Little Trumpet','handheld','rare','earnable','angels','moliboo.outfit.sunrise_herald','item_little_trumpet','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,8);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.sunbeam_aura','Sunbeam Aura','aura','rare','earnable','angels','moliboo.outfit.sunrise_herald','item_sunbeam_aura','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,9);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.guardian_circlet','Guardian Circlet','headwear','legendary','premium','angels','moliboo.outfit.celestial_guardian','item_guardian_circlet','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,10);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.pearl_locks','Pearl Locks','hair','legendary','premium','angels','moliboo.outfit.celestial_guardian','item_pearl_locks','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,11);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.guardian_mantle','Guardian Mantle','outerwear','legendary','premium','angels','moliboo.outfit.celestial_guardian','item_guardian_mantle','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,12);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.shield_wings','Shield Wings','back','legendary','premium','angels','moliboo.outfit.celestial_guardian','item_shield_wings','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,13);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.gilded_halo_fx','Gilded Halo FX','aura','legendary','premium','angels','moliboo.outfit.celestial_guardian','item_gilded_halo_fx','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,14);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.neon_cap','Neon Cap','headwear','common','free','underground','moliboo.outfit.neon_skater','item_neon_cap','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,15);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.spiky_tuft','Spiky Tuft','hair','common','free','underground','moliboo.outfit.neon_skater','item_spiky_tuft','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,16);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.glow_hoodie','Glow Hoodie','top','common','free','underground','moliboo.outfit.neon_skater','item_glow_hoodie','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,17);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.light_up_kicks','Light-up Kicks','footwear','common','free','underground','moliboo.outfit.neon_skater','item_light_up_kicks','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,18);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.mini_board','Mini Board','handheld','common','free','underground','moliboo.outfit.neon_skater','item_mini_board','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,19);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.studio_headphones','Studio Headphones','headwear','rare','earnable','underground','moliboo.outfit.beat_crew','item_studio_headphones','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,20);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.pixel_fringe','Pixel Fringe','hair','rare','earnable','underground','moliboo.outfit.beat_crew','item_pixel_fringe','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,21);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.bass_tee','Bass Tee','top','rare','earnable','underground','moliboo.outfit.beat_crew','item_bass_tee','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,22);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.visor_shades','Visor Shades','face','rare','earnable','underground','moliboo.outfit.beat_crew','item_visor_shades','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,23);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.sound_rings','Sound Rings','aura','rare','earnable','underground','moliboo.outfit.beat_crew','item_sound_rings','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,24);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.holo_visor_band','Holo Visor Band','headwear','epic','premium','underground','moliboo.outfit.holo_runner','item_holo_visor_band','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,25);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.circuit_mohawk','Circuit Mohawk','hair','epic','premium','underground','moliboo.outfit.holo_runner','item_circuit_mohawk','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,26);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.hologram_jacket','Hologram Jacket','outerwear','epic','premium','underground','moliboo.outfit.holo_runner','item_hologram_jacket','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,27);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.spark_sneakers','Spark Sneakers','footwear','epic','premium','underground','moliboo.outfit.holo_runner','item_spark_sneakers','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,28);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.glitch_trail','Glitch Trail','aura','epic','premium','underground','moliboo.outfit.holo_runner','item_glitch_trail','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,29);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.leaf_cap','Leaf Cap','headwear','common','free','enchanted','moliboo.outfit.mossy_ranger','item_leaf_cap','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,30);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.leaf_fringe','Leaf Fringe','hair','common','free','enchanted','moliboo.outfit.mossy_ranger','item_leaf_fringe','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,31);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.fern_vest','Fern Vest','top','common','free','enchanted','moliboo.outfit.mossy_ranger','item_fern_vest','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,32);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.acorn_pack','Acorn Pack','back','common','free','enchanted','moliboo.outfit.mossy_ranger','item_acorn_pack','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,33);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.twig_wand','Twig Wand','handheld','common','free','enchanted','moliboo.outfit.mossy_ranger','item_twig_wand','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,34);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.bramble_beret','Bramble Beret','headwear','uncommon','earnable','enchanted','moliboo.outfit.berry_bard','item_bramble_beret','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,35);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.berry_buns','Berry Buns','hair','uncommon','earnable','enchanted','moliboo.outfit.berry_bard','item_berry_buns','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,36);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.petal_blouse','Petal Blouse','top','uncommon','earnable','enchanted','moliboo.outfit.berry_bard','item_petal_blouse','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,37);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.reed_flute','Reed Flute','handheld','uncommon','earnable','enchanted','moliboo.outfit.berry_bard','item_reed_flute','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,38);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.petal_drift','Petal Drift','aura','uncommon','earnable','enchanted','moliboo.outfit.berry_bard','item_petal_drift','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,39);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.antler_crown','Antler Crown','headwear','legendary','premium','enchanted','moliboo.outfit.elder_grove','item_antler_crown','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,40);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.moss_mane','Moss Mane','hair','legendary','premium','enchanted','moliboo.outfit.elder_grove','item_moss_mane','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,41);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.bark_cloak','Bark Cloak','outerwear','legendary','premium','enchanted','moliboo.outfit.elder_grove','item_bark_cloak','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,42);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.firefly_freckles','Firefly Freckles','face','legendary','premium','enchanted','moliboo.outfit.elder_grove','item_firefly_freckles','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,43);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.spore_sparkles','Spore Sparkles','aura','legendary','premium','enchanted','moliboo.outfit.elder_grove','item_spore_sparkles','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,44);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.star_headband','Star Headband','headwear','common','free','stardust','moliboo.outfit.comet_cadet','item_star_headband','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,45);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.star_parting','Star Parting','hair','common','free','stardust','moliboo.outfit.comet_cadet','item_star_parting','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,46);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.cadet_jumpsuit','Cadet Jumpsuit','top','common','free','stardust','moliboo.outfit.comet_cadet','item_cadet_jumpsuit','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,47);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.moon_boots','Moon Boots','footwear','common','free','stardust','moliboo.outfit.comet_cadet','item_moon_boots','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,48);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.mini_jetpack','Mini Jetpack','back','common','free','stardust','moliboo.outfit.comet_cadet','item_mini_jetpack','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,49);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.explorer_helmet','Explorer Helmet','headwear','rare','earnable','stardust','moliboo.outfit.constellation_scout','item_explorer_helmet','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,50);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.nebula_tuft','Nebula Tuft','hair','rare','earnable','stardust','moliboo.outfit.constellation_scout','item_nebula_tuft','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,51);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.star_map_poncho','Star Map Poncho','outerwear','rare','earnable','stardust','moliboo.outfit.constellation_scout','item_star_map_poncho','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,52);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.pocket_telescope','Pocket Telescope','handheld','rare','earnable','stardust','moliboo.outfit.constellation_scout','item_pocket_telescope','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,53);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.star_trail','Star Trail','aura','rare','earnable','stardust','moliboo.outfit.constellation_scout','item_star_trail','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,54);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.aurora_tiara','Aurora Tiara','headwear','epic','premium','stardust','moliboo.outfit.aurora_navigator','item_aurora_tiara','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,55);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.aurora_bangs','Aurora Bangs','hair','epic','premium','stardust','moliboo.outfit.aurora_navigator','item_aurora_bangs','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,56);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.ribbon_coat','Ribbon Coat','outerwear','epic','premium','stardust','moliboo.outfit.aurora_navigator','item_ribbon_coat','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,57);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.stardust_gems','Stardust Gems','face','epic','premium','stardust','moliboo.outfit.aurora_navigator','item_stardust_gems','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,58);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.aurora_veil','Aurora Veil','aura','epic','premium','stardust','moliboo.outfit.aurora_navigator','item_aurora_veil','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,59);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.starry_nightcap','Starry Nightcap','headwear','common','free','dreamers','moliboo.outfit.sleepy_star','item_starry_nightcap','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,60);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.fluffy_tuft','Fluffy Tuft','hair','common','free','dreamers','moliboo.outfit.sleepy_star','item_fluffy_tuft','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,61);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.cloud_pyjamas','Cloud Pyjamas','top','common','free','dreamers','moliboo.outfit.sleepy_star','item_cloud_pyjamas','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,62);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.bunny_slippers','Bunny Slippers','footwear','common','free','dreamers','moliboo.outfit.sleepy_star','item_bunny_slippers','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,63);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.plush_star','Plush Star','handheld','common','free','dreamers','moliboo.outfit.sleepy_star','item_plush_star','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,64);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.moon_bonnet','Moon Bonnet','headwear','uncommon','earnable','dreamers','moliboo.outfit.lullaby_lantern','item_moon_bonnet','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,65);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.wavy_fringe','Wavy Fringe','hair','uncommon','earnable','dreamers','moliboo.outfit.lullaby_lantern','item_wavy_fringe','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,66);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.quilt_cape','Quilt Cape','outerwear','uncommon','earnable','dreamers','moliboo.outfit.lullaby_lantern','item_quilt_cape','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,67);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.dream_lantern','Dream Lantern','handheld','uncommon','earnable','dreamers','moliboo.outfit.lullaby_lantern','item_dream_lantern','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,68);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.lullaby_notes','Lullaby Notes','aura','uncommon','earnable','dreamers','moliboo.outfit.lullaby_lantern','item_lullaby_notes','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,69);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.moonring_crown','Moonring Crown','headwear','legendary','premium','dreamers','moliboo.outfit.dream_keeper','item_moonring_crown','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,70);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.silver_drift_locks','Silver Drift Locks','hair','legendary','premium','dreamers','moliboo.outfit.dream_keeper','item_silver_drift_locks','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,71);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.night_sky_robe','Night-Sky Robe','outerwear','legendary','premium','dreamers','moliboo.outfit.dream_keeper','item_night_sky_robe','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,72);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.sleep_mask','Sleep Mask','face','legendary','premium','dreamers','moliboo.outfit.dream_keeper','item_sleep_mask','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,73);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.dream_bubbles','Dream Bubbles','aura','legendary','premium','dreamers','moliboo.outfit.dream_keeper','item_dream_bubbles','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,74);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.heart_cheeks','Heart Cheeks','face','common','free','angels',NULL,'item_heart_cheeks','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,75);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.cloud_sandals','Cloud Sandals','footwear','common','free','angels',NULL,'item_cloud_sandals','["#EDB94A", "#8CCBFF", "#FFF4D6", "#9A6B1F"]'::jsonb,76);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.spray_can_pack','Spray Can Pack','back','common','free','underground',NULL,'item_spray_can_pack','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,77);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.cargo_shorts','Cargo Shorts','bottom','common','free','underground',NULL,'item_cargo_shorts','["#FF4FA3", "#36E3F0", "#2B2B3D", "#B6FF5C"]'::jsonb,78);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.mushroom_boots','Mushroom Boots','footwear','common','free','enchanted',NULL,'item_mushroom_boots','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,79);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.leaf_skirt','Leaf Skirt','bottom','uncommon','earnable','enchanted',NULL,'item_leaf_skirt','["#5BAE6A", "#B0306A", "#8FCB7B", "#3E6B3A"]'::jsonb,80);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.star_glasses','Star Glasses','face','common','free','stardust',NULL,'item_star_glasses','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,81);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.orbit_shorts','Orbit Shorts','bottom','common','free','stardust',NULL,'item_orbit_shorts','["#3A3FA8", "#FFD45C", "#8A6BE8", "#1E2160"]'::jsonb,82);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.pillow_backpack','Pillow Backpack','back','common','free','dreamers',NULL,'item_pillow_backpack','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,83);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.cosy_leggings','Cosy Leggings','bottom','uncommon','earnable','dreamers',NULL,'item_cosy_leggings','["#B9A7F2", "#8EC5FF", "#FFC9A8", "#6B5BB5"]'::jsonb,84);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.party_cone','Party Cone','headwear','common','free',NULL,NULL,'item_party_cone','["#FF8FB1", "#7FD3FF", "#FFE17A", "#6C63FF"]'::jsonb,85);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.knit_beanie','Knit Beanie','headwear','common','free',NULL,NULL,'item_knit_beanie','["#FF8FB1", "#7FD3FF", "#FFE17A", "#6C63FF"]'::jsonb,86);
INSERT INTO greenfield_moliboo_items (item_id,name,slot,rarity,access,family,set_id,icon_key,palette,sort_order) VALUES ('moliboo.item.round_glasses','Round Glasses','face','common','free',NULL,NULL,'item_round_glasses','["#FF8FB1", "#7FD3FF", "#FFE17A", "#6C63FF"]'::jsonb,87);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.halo_choir','Halo Choir','angels','free','common','["moliboo.item.halo_ring", "moliboo.item.cloud_curls", "moliboo.item.pearl_tunic", "moliboo.item.feather_wings", "moliboo.item.soft_glow"]'::jsonb,'outfit_halo_choir','moliboo.buff.set_halo_choir',0);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.sunrise_herald','Sunrise Herald','angels','earnable','rare','["moliboo.item.sunray_crown", "moliboo.item.golden_sweep", "moliboo.item.dawn_cape_top", "moliboo.item.little_trumpet", "moliboo.item.sunbeam_aura"]'::jsonb,'outfit_sunrise_herald','moliboo.buff.set_sunrise_herald',1);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.celestial_guardian','Celestial Guardian','angels','premium','legendary','["moliboo.item.guardian_circlet", "moliboo.item.pearl_locks", "moliboo.item.guardian_mantle", "moliboo.item.shield_wings", "moliboo.item.gilded_halo_fx"]'::jsonb,'outfit_celestial_guardian','moliboo.buff.set_celestial_guardian',2);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.neon_skater','Neon Skater','underground','free','common','["moliboo.item.neon_cap", "moliboo.item.spiky_tuft", "moliboo.item.glow_hoodie", "moliboo.item.light_up_kicks", "moliboo.item.mini_board"]'::jsonb,'outfit_neon_skater','moliboo.buff.set_neon_skater',3);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.beat_crew','Beat Crew','underground','earnable','rare','["moliboo.item.studio_headphones", "moliboo.item.pixel_fringe", "moliboo.item.bass_tee", "moliboo.item.visor_shades", "moliboo.item.sound_rings"]'::jsonb,'outfit_beat_crew','moliboo.buff.set_beat_crew',4);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.holo_runner','Holo Runner','underground','premium','epic','["moliboo.item.holo_visor_band", "moliboo.item.circuit_mohawk", "moliboo.item.hologram_jacket", "moliboo.item.spark_sneakers", "moliboo.item.glitch_trail"]'::jsonb,'outfit_holo_runner','moliboo.buff.set_holo_runner',5);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.mossy_ranger','Mossy Ranger','enchanted','free','common','["moliboo.item.leaf_cap", "moliboo.item.leaf_fringe", "moliboo.item.fern_vest", "moliboo.item.acorn_pack", "moliboo.item.twig_wand"]'::jsonb,'outfit_mossy_ranger','moliboo.buff.set_mossy_ranger',6);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.berry_bard','Berry Bard','enchanted','earnable','uncommon','["moliboo.item.bramble_beret", "moliboo.item.berry_buns", "moliboo.item.petal_blouse", "moliboo.item.reed_flute", "moliboo.item.petal_drift"]'::jsonb,'outfit_berry_bard','moliboo.buff.set_berry_bard',7);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.elder_grove','Elder Grove','enchanted','premium','legendary','["moliboo.item.antler_crown", "moliboo.item.moss_mane", "moliboo.item.bark_cloak", "moliboo.item.firefly_freckles", "moliboo.item.spore_sparkles"]'::jsonb,'outfit_elder_grove','moliboo.buff.set_elder_grove',8);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.comet_cadet','Comet Cadet','stardust','free','common','["moliboo.item.star_headband", "moliboo.item.star_parting", "moliboo.item.cadet_jumpsuit", "moliboo.item.moon_boots", "moliboo.item.mini_jetpack"]'::jsonb,'outfit_comet_cadet','moliboo.buff.set_comet_cadet',9);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.constellation_scout','Constellation Scout','stardust','earnable','rare','["moliboo.item.explorer_helmet", "moliboo.item.nebula_tuft", "moliboo.item.star_map_poncho", "moliboo.item.pocket_telescope", "moliboo.item.star_trail"]'::jsonb,'outfit_constellation_scout','moliboo.buff.set_constellation_scout',10);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.aurora_navigator','Aurora Navigator','stardust','premium','epic','["moliboo.item.aurora_tiara", "moliboo.item.aurora_bangs", "moliboo.item.ribbon_coat", "moliboo.item.stardust_gems", "moliboo.item.aurora_veil"]'::jsonb,'outfit_aurora_navigator','moliboo.buff.set_aurora_navigator',11);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.sleepy_star','Sleepy Star','dreamers','free','common','["moliboo.item.starry_nightcap", "moliboo.item.fluffy_tuft", "moliboo.item.cloud_pyjamas", "moliboo.item.bunny_slippers", "moliboo.item.plush_star"]'::jsonb,'outfit_sleepy_star','moliboo.buff.set_sleepy_star',12);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.lullaby_lantern','Lullaby Lantern','dreamers','earnable','uncommon','["moliboo.item.moon_bonnet", "moliboo.item.wavy_fringe", "moliboo.item.quilt_cape", "moliboo.item.dream_lantern", "moliboo.item.lullaby_notes"]'::jsonb,'outfit_lullaby_lantern','moliboo.buff.set_lullaby_lantern',13);
INSERT INTO greenfield_moliboo_outfit_sets (set_id,name,family,access,rarity,item_ids,icon_key,set_bonus_buff_id,sort_order) VALUES ('moliboo.outfit.dream_keeper','Dream Keeper','dreamers','premium','legendary','["moliboo.item.moonring_crown", "moliboo.item.silver_drift_locks", "moliboo.item.night_sky_robe", "moliboo.item.sleep_mask", "moliboo.item.dream_bubbles"]'::jsonb,'outfit_dream_keeper','moliboo.buff.set_dream_keeper',14);
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.aura','moliboo.angels.aura','angels','Guiding Glow','Creates illuminated paths through darkness and mist.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.soli','moliboo.angels.soli','angels','Sunshine Burst','Illuminates its surroundings with a cheerful warm pulse.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.luma','moliboo.angels.luma','angels','Moonveil','Creates a calming field of moonlight.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.vela','moliboo.angels.vela','angels','Skytrail','Leaves temporary floating trails that reveal otherwise inaccessible paths.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.cheri','moliboo.angels.cheri','angels','Heartlink','Creates visible light links between cooperating friends.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.hush','moliboo.angels.hush','angels','Featherfall','Creates soft floating platforms and cushioned landings.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.haloa','moliboo.angels.haloa','angels','Orbiting Light','Creates temporary circular barriers and floating rings.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.lyra','moliboo.angels.lyra','angels','Harmony Notes','Creates musical patterns that interact with the environment.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.celio','moliboo.angels.celio','angels','Skycurrent','Creates currents of air that carry companions and objects.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.dovee','moliboo.angels.dovee','angels','Peacewind','Generates a gentle wind to calm unstable environments.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.twila','moliboo.angels.twila','angels','Duskveil','Reveals faint patterns visible only in twilight.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.gleam','moliboo.angels.gleam','angels','Radiant Ripple','Creates expanding waves of coloured light.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.novael','moliboo.angels.novael','angels','Starbound','Executes short bursts of spectacular high-speed movement.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.sera','moliboo.angels.sera','angels','Guardian Embrace','Creates a temporary protective field around companions.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.auri','moliboo.angels.auri','angels','Aurora Bloom','Creates shifting ribbons of colourful light across the sky.',14400,'moliboo.buff.signature_angels');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.riff','moliboo.underground.riff','underground','Beatwave','Sends short visible sound pulses through nearby objects to reveal rhythm patterns.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.graff','moliboo.underground.graff','underground','Colourburst','Paints temporary visible routes and symbols that vanish without leaving permanent marks.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.nyx','moliboo.underground.nyx','underground','Shadow Slip','Moves through connected patches of shade inside the fictional world.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.zip','moliboo.underground.zip','underground','Neon Dash','Follows temporary light-tracks at high speed.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.vex','moliboo.underground.vex','underground','Shortcut Sense','Spots hidden routes and overlooked entrances in puzzle environments.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.koda','moliboo.underground.koda','underground','Hidden Cache','Reveals optional objects and collectible clues tucked away in scenes.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.glitch','moliboo.underground.glitch','underground','Pixel Shift','Rearranges simple virtual shapes to complete puzzles inside games.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.jinx','moliboo.underground.jinx','underground','Moonstep','Creates short faint footprints visible only in nighttime environments.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.static','moliboo.underground.static','underground','Spark Jump','Activates small fictional switches and conductive puzzle paths.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.holo','moliboo.underground.holo','underground','Light Double','Projects temporary decoy shapes for harmless game puzzles.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.fuse','moliboo.underground.fuse','underground','Charge Share','Supplies temporary energy to non-dangerous in-game gadgets and puzzles.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.skid','moliboo.underground.skid','underground','Rail Ride','Traverses designated skate rails and surfaces within the game world.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.mica','moliboo.underground.mica','underground','Crystal Sense','Detects hidden mineral patterns and creates clues in underground exploration puzzles.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.rumble','moliboo.underground.rumble','underground','Groundbeat','Creates controlled, harmless tremors that rearrange puzzle platforms.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.flick','moliboo.underground.flick','underground','Glowtrail','Leaves short luminous signposts and patterns useful for routes and puzzles.',14400,'moliboo.buff.signature_underground');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.bramble','moliboo.enchanted.bramble','enchanted','Bramble Bridge','Grows temporary thorn-vines that safely connect short gaps in a forest puzzle.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.ferni','moliboo.enchanted.ferni','enchanted','Frond Finder','Unfurls leaves that reveal hidden markers or lightly covered trail signs.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.truffle','moliboo.enchanted.truffle','enchanted','Spore Spark','Releases benign glowing spores that highlight safe mushroom paths in game scenes.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.rootle','moliboo.enchanted.rootle','enchanted','Root Route','Grows a simple root-path along designated surfaces for a short duration.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.willow','moliboo.enchanted.willow','enchanted','Willow Whisper','Reveals hidden lore marks by letting the leaves sway in the direction of an ancient story.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.pollen','moliboo.enchanted.pollen','enchanted','Seed Sail','Rides gentle drafts across small gaps and carries lightweight quest objects.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.mallow','moliboo.enchanted.mallow','enchanted','Bloom Circle','Makes a small patch of flowers bloom, revealing a friendly cooperative clue.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.acora','moliboo.enchanted.acora','enchanted','Oakbound','Plants an acorn marker which briefly grows into a stable stepping platform.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.spindle','moliboo.enchanted.spindle','enchanted','Silkline','Weaves temporary shimmering lines between approved puzzle anchors.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.glade','moliboo.enchanted.glade','enchanted','Grove Step','Highlights safe pathways and calm crossing points through forest terrain.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.lichen','moliboo.enchanted.lichen','enchanted','Shell Shelter','Becomes a temporary sturdy platform or a safe waiting point in cooperative challenges.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.thimble','moliboo.enchanted.thimble','enchanted','Nest Nook','Builds temporary safe rest spots from found leaves during longer explorations.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.wyrmi','moliboo.enchanted.wyrmi','enchanted','Autumn Gust','Sends a gentle swirl of leaves that activates seasonal switches and uncovers small objects.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.kiko','moliboo.enchanted.kiko','enchanted','Jewel Glint','Reflects nearby light beams to reveal hidden carved symbols or collectible clues.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.eldra','moliboo.enchanted.eldra','enchanted','Ancient Ring','Reveals fragments of past forest scenes at designated narrative landmarks.',14400,'moliboo.buff.signature_enchanted');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.astra','moliboo.stardust.astra','stardust','Starlane','Sketches short-lived guiding constellations through fog or darkness.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.nebbi','moliboo.stardust.nebbi','stardust','Dreamcloud','Reveals hidden shapes by forming temporary nebula pictures.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.quori','moliboo.stardust.quori','stardust','Orbit Step','Creates brief looping platforms for other characters to hop across.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.vesper','moliboo.stardust.vesper','stardust','Duskstream','Leaves a temporary illuminated wake through dark terrain.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.pulsa','moliboo.stardust.pulsa','stardust','Pulse Ring','Sends rhythmic shockwaves that activate nearby mechanisms.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.stellan','moliboo.stardust.stellan','stardust','Starstep','Summons brief footholds made from gathered starlight.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.cosmi','moliboo.stardust.cosmi','stardust','Galaxy Bounce','Chains safe gravity-defying hops between nearby platforms.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.eclipa','moliboo.stardust.eclipa','stardust','Eclipse Veil','Alternates soft light and shadow to expose hidden clues.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.meteo','moliboo.stardust.meteo','stardust','Meteor Dash','Performs controlled short bursts over marked speed tracks.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.asteri','moliboo.stardust.asteri','stardust','Star Pattern','Aligns fragments to unlock map puzzles and reflective surfaces.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.zenith','moliboo.stardust.zenith','stardust','Sunward','Projects a stable field that shields companions from environmental hazards.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.liora','moliboo.stardust.liora','stardust','Aurora Bloom','Paints the sky with changing paths of light and colour.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.nocta','moliboo.stardust.nocta','stardust','Nightweave','Uncovers hidden constellations as the wings flutter in darkness.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.glint','moliboo.stardust.glint','stardust','Sparktrail','Marks interactive surfaces with temporary glittering dots.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.polaris','moliboo.stardust.polaris','stardust','Northlight','Reveals a safe direction through unfamiliar cosmic routes.',14400,'moliboo.buff.signature_stardust');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.dozi','moliboo.dreamers.dozi','dreamers','Drowsy Glow','Makes a soothing lantern-like light around a safe resting place.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.lulli','moliboo.dreamers.lulli','dreamers','Humming Haze','Projects visual music-notes that reveal gentle rhythmic paths.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.moona','moliboo.dreamers.moona','dreamers','Moonpath','Creates temporary crescent platforms over dream chasms.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.nuzzle','moliboo.dreamers.nuzzle','dreamers','Cloud Cushion','Provides a temporary soft landing surface for others.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.drifty','moliboo.dreamers.drifty','dreamers','Blanket Bounce','Springs between floating quilt pads.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.hushby','moliboo.dreamers.hushby','dreamers','Woolway','Spins small cloud stepping stones from loose wool tufts.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.swayla','moliboo.dreamers.swayla','dreamers','Lantern Trail','Lights temporary safe waypoints in a dream maze.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.snoomi','moliboo.dreamers.snoomi','dreamers','Cozy Pause','Briefly settles moving platforms in gentle puzzle scenes.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.velvi','moliboo.dreamers.velvi','dreamers','Dreamweave','Reveals hidden pathways by tracing light across wing patterns.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.minku','moliboo.dreamers.minku','dreamers','Whisperwing','Creates brief silent wind routes through dream caves.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.tufti','moliboo.dreamers.tufti','dreamers','Soft Step','Moves across delicate dream surfaces without disturbing them.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.winkle','moliboo.dreamers.winkle','dreamers','Dream Current','Carries friends along a slow safe arc of floating starlight.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.sonata','moliboo.dreamers.sonata','dreamers','Melody Stair','Builds a temporary note-step pattern in rhythmic sequences.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.comfi','moliboo.dreamers.comfi','dreamers','Blanket Fort','Creates a short-lived safe space for cooperative dream puzzles.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_skills VALUES ('moliboo.skill.somna','moliboo.dreamers.somna','dreamers','Dream Atlas','Briefly connects scattered dream paths into a navigable constellation.',14400,'moliboo.buff.signature_dreamers');
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.daily_care_trio','daily','Care trio','Do any 3 care actions with any Moliboo.','care',NULL,3,'{"type": "friendship_xp", "amount": 30}'::jsonb,0);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.daily_signature','daily','Show-off','Use one signature skill.','skill_use',NULL,1,'{"type": "friendship_xp", "amount": 20}'::jsonb,1);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.daily_dressup','daily','Dress-up','Equip an outfit or change one item.','equip',NULL,1,'{"type": "friendship_xp", "amount": 15}'::jsonb,2);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.weekly_caretaker','weekly','Weekly caretaker','Do 15 care actions this week (no streak needed).','care',NULL,15,'{"type": "surprise_item", "pool": ["moliboo.item.sunray_crown", "moliboo.item.golden_sweep", "moliboo.item.dawn_cape_top", "moliboo.item.little_trumpet", "moliboo.item.sunbeam_aura", "moliboo.item.studio_headphones", "moliboo.item.pixel_fringe", "moliboo.item.bass_tee", "moliboo.item.visor_shades", "moliboo.item.sound_rings", "moliboo.item.bramble_beret", "moliboo.item.berry_buns", "moliboo.item.petal_blouse", "moliboo.item.reed_flute", "moliboo.item.petal_drift", "moliboo.item.explorer_helmet", "moliboo.item.nebula_tuft", "moliboo.item.star_map_poncho", "moliboo.item.pocket_telescope", "moliboo.item.star_trail", "moliboo.item.moon_bonnet", "moliboo.item.wavy_fringe", "moliboo.item.quilt_cape", "moliboo.item.dream_lantern", "moliboo.item.lullaby_notes", "moliboo.item.leaf_skirt", "moliboo.item.cosy_leggings"], "disclosed": true}'::jsonb,3);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.ach_first_outfit','achievement','First Outfit','Save your first own outfit.','outfit_saved',NULL,1,'{"type": "item", "itemId": "moliboo.item.cloud_curls"}'::jsonb,4);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.ach_stylist','achievement','Stylist','Save 5 outfits.','outfit_saved',NULL,5,'{"type": "item", "itemId": "moliboo.item.petal_drift"}'::jsonb,5);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.ach_skill_explorer','achievement','Skill explorer','Use 10 signature skills.','skill_use',NULL,10,'{"type": "item", "itemId": "moliboo.item.star_trail"}'::jsonb,6);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.ach_caretaker_50','achievement','Devoted friend','Do 50 care actions in total.','care',NULL,50,'{"type": "item", "itemId": "moliboo.item.lullaby_notes"}'::jsonb,7);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.ach_mini_games','achievement','Mini-game fan','Finish 5 mini-activities (Bubble Pop, Star Catch, Memory Match).','activity_complete',NULL,5,'{"type": "item", "itemId": "moliboo.item.sound_rings"}'::jsonb,8);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.daily_activity','daily','Play time','Finish one mini-activity.','activity_complete',NULL,1,'{"type": "friendship_xp", "amount": 20}'::jsonb,9);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_sunray_crown','collection','Unlock Sunray Crown','Do 8 care actions with a Angels Moliboo.','care','angels',8,'{"type": "item", "itemId": "moliboo.item.sunray_crown"}'::jsonb,10);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_golden_sweep','collection','Unlock Golden Sweep','Do 8 care actions with a Angels Moliboo.','care','angels',8,'{"type": "item", "itemId": "moliboo.item.golden_sweep"}'::jsonb,11);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_dawn_cape_top','collection','Unlock Dawn Cape Top','Do 8 care actions with a Angels Moliboo.','care','angels',8,'{"type": "item", "itemId": "moliboo.item.dawn_cape_top"}'::jsonb,12);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_little_trumpet','collection','Unlock Little Trumpet','Do 8 care actions with a Angels Moliboo.','care','angels',8,'{"type": "item", "itemId": "moliboo.item.little_trumpet"}'::jsonb,13);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_sunbeam_aura','collection','Unlock Sunbeam Aura','Do 8 care actions with a Angels Moliboo.','care','angels',8,'{"type": "item", "itemId": "moliboo.item.sunbeam_aura"}'::jsonb,14);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_studio_headphones','collection','Unlock Studio Headphones','Do 8 care actions with a Underground Moliboo.','care','underground',8,'{"type": "item", "itemId": "moliboo.item.studio_headphones"}'::jsonb,15);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_pixel_fringe','collection','Unlock Pixel Fringe','Do 8 care actions with a Underground Moliboo.','care','underground',8,'{"type": "item", "itemId": "moliboo.item.pixel_fringe"}'::jsonb,16);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_bass_tee','collection','Unlock Bass Tee','Do 8 care actions with a Underground Moliboo.','care','underground',8,'{"type": "item", "itemId": "moliboo.item.bass_tee"}'::jsonb,17);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_visor_shades','collection','Unlock Visor Shades','Do 8 care actions with a Underground Moliboo.','care','underground',8,'{"type": "item", "itemId": "moliboo.item.visor_shades"}'::jsonb,18);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_bramble_beret','collection','Unlock Bramble Beret','Do 8 care actions with a Enchanted Moliboo.','care','enchanted',8,'{"type": "item", "itemId": "moliboo.item.bramble_beret"}'::jsonb,19);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_berry_buns','collection','Unlock Berry Buns','Do 8 care actions with a Enchanted Moliboo.','care','enchanted',8,'{"type": "item", "itemId": "moliboo.item.berry_buns"}'::jsonb,20);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_petal_blouse','collection','Unlock Petal Blouse','Do 8 care actions with a Enchanted Moliboo.','care','enchanted',8,'{"type": "item", "itemId": "moliboo.item.petal_blouse"}'::jsonb,21);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_reed_flute','collection','Unlock Reed Flute','Do 8 care actions with a Enchanted Moliboo.','care','enchanted',8,'{"type": "item", "itemId": "moliboo.item.reed_flute"}'::jsonb,22);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_explorer_helmet','collection','Unlock Explorer Helmet','Do 8 care actions with a Stardust Moliboo.','care','stardust',8,'{"type": "item", "itemId": "moliboo.item.explorer_helmet"}'::jsonb,23);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_nebula_tuft','collection','Unlock Nebula Tuft','Do 8 care actions with a Stardust Moliboo.','care','stardust',8,'{"type": "item", "itemId": "moliboo.item.nebula_tuft"}'::jsonb,24);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_star_map_poncho','collection','Unlock Star Map Poncho','Do 8 care actions with a Stardust Moliboo.','care','stardust',8,'{"type": "item", "itemId": "moliboo.item.star_map_poncho"}'::jsonb,25);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_pocket_telescope','collection','Unlock Pocket Telescope','Do 8 care actions with a Stardust Moliboo.','care','stardust',8,'{"type": "item", "itemId": "moliboo.item.pocket_telescope"}'::jsonb,26);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_moon_bonnet','collection','Unlock Moon Bonnet','Do 8 care actions with a Dreamers Moliboo.','care','dreamers',8,'{"type": "item", "itemId": "moliboo.item.moon_bonnet"}'::jsonb,27);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_wavy_fringe','collection','Unlock Wavy Fringe','Do 8 care actions with a Dreamers Moliboo.','care','dreamers',8,'{"type": "item", "itemId": "moliboo.item.wavy_fringe"}'::jsonb,28);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_quilt_cape','collection','Unlock Quilt Cape','Do 8 care actions with a Dreamers Moliboo.','care','dreamers',8,'{"type": "item", "itemId": "moliboo.item.quilt_cape"}'::jsonb,29);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_dream_lantern','collection','Unlock Dream Lantern','Do 8 care actions with a Dreamers Moliboo.','care','dreamers',8,'{"type": "item", "itemId": "moliboo.item.dream_lantern"}'::jsonb,30);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_leaf_skirt','collection','Unlock Leaf Skirt','Finish 3 mini-activities.','activity_complete',NULL,3,'{"type": "item", "itemId": "moliboo.item.leaf_skirt"}'::jsonb,31);
INSERT INTO greenfield_moliboo_quests (quest_id,kind,title,description,event_type,family_filter,target,reward,sort_order) VALUES ('moliboo.quest.collect_cosy_leggings','collection','Unlock Cosy Leggings','Finish 3 mini-activities.','activity_complete',NULL,3,'{"type": "item", "itemId": "moliboo.item.cosy_leggings"}'::jsonb,32);

GRANT SELECT ON greenfield_moliboo_items, greenfield_moliboo_outfit_sets, greenfield_moliboo_buff_definitions, greenfield_moliboo_skills, greenfield_moliboo_quests TO modula_api, modula_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_moliboo_inventory, greenfield_moliboo_user_outfits, greenfield_moliboo_equipped, greenfield_moliboo_active_buffs, greenfield_moliboo_quest_progress, greenfield_moliboo_friendship TO modula_api, modula_worker;
GRANT SELECT, INSERT ON greenfield_moliboo_events TO modula_api, modula_worker;
GRANT SELECT ON greenfield_moliboo_items, greenfield_moliboo_outfit_sets, greenfield_moliboo_buff_definitions, greenfield_moliboo_skills, greenfield_moliboo_quests, greenfield_moliboo_inventory, greenfield_moliboo_user_outfits, greenfield_moliboo_equipped, greenfield_moliboo_active_buffs, greenfield_moliboo_quest_progress, greenfield_moliboo_friendship, greenfield_moliboo_events TO modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '083')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
