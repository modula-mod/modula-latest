-- MOLIBOO-GENESIS-02: seed the canonical First-100 definitions that the
-- master doc (MOLIBOOS_complete_ecosystem.md §1 and §14) actually confirms.
--
-- Seeded here (16 rows):
-- * Pip, Moliboo #001 — "The collection begins with Pip" (§1).
-- * The Dreamers, #086–100 — the complete name-to-ID mapping given in §14:
--   Dozi 086, Lulli 087, Moona 088, Nuzzle 089, Drifty 090, Hushby 091,
--   Swayla 092, Snoomi 093, Velvi 094, Minku 095, Tufti 096, Winkle 097,
--   Sonata 098, Comfi 099, Somna 100 ("ends with Somna", §1).
--
-- Deliberately NOT seeded:
-- * #002–085 — the master doc does not give a verified name-to-ID mapping
--   for them ("I do not have the complete verified name-to-ID mapping for
--   all 100 characters available here", §14). No names are invented.
-- * Pebble — the doc confirms a character sheet v2.1 exists but assigns no
--   number ("I have not ... assigned Pebble an unverified number", §14).
-- * Any 041–070 family assignment — the master doc says Tech/Neon 041–055
--   and Underground/Nature 056–070 (§1), while the earlier family bibles
--   said Underground 041–055 and Enchanted 056–070, and the server's own
--   game catalogue (migration 083) already uses 'underground' and
--   'enchanted'. That rename is unresolved; nothing here renames or
--   renumbers anything. The 100-vs-215 code-registry discrepancy stays
--   open and is flagged in the Genesis report, not resolved here.
--
-- Family IDs used: 'originals' for Pip (the doc's collection name "The
-- Originals", §1) and 'dreamers' for #086–100 (already the server's
-- catalogue family for Dreamers items in migration 083).
-- Series is 1 (Generation One). All 17 are wearable official characters
-- (the non-wearable rule applies to Legends #101–115, seeded separately
-- by the Series 2 QA fixture, not here).
--
-- ON CONFLICT DO NOTHING keeps this idempotent and forward-compatible:
-- any future signed-pack ingestion for these character IDs must use the
-- same conflict handling (as the Legends seed does), never fail on the
-- rows created here.

INSERT INTO greenfield_moliboo_characters
  (character_id, character_number, character_key, display_name, family_id, series, wearable, created_at, updated_at)
VALUES
  ('moliboo.1', 1, 'pip', 'Pip', 'originals', 1, true, NOW(), NOW()),
  ('moliboo.86', 86, 'dozi', 'Dozi', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.87', 87, 'lulli', 'Lulli', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.88', 88, 'moona', 'Moona', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.89', 89, 'nuzzle', 'Nuzzle', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.90', 90, 'drifty', 'Drifty', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.91', 91, 'hushby', 'Hushby', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.92', 92, 'swayla', 'Swayla', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.93', 93, 'snoomi', 'Snoomi', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.94', 94, 'velvi', 'Velvi', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.95', 95, 'minku', 'Minku', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.96', 96, 'tufti', 'Tufti', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.97', 97, 'winkle', 'Winkle', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.98', 98, 'sonata', 'Sonata', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.99', 99, 'comfi', 'Comfi', 'dreamers', 1, true, NOW(), NOW()),
  ('moliboo.100', 100, 'somna', 'Somna', 'dreamers', 1, true, NOW(), NOW())
ON CONFLICT (character_id) DO NOTHING;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '100')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
