-- GREENFIELD-FUNCTIONAL-PARITY-01: bind Stories to the verified attachment
-- pipeline while retaining the legacy inline-media contract during Native
-- rollout.

ALTER TABLE greenfield_story_items
  ADD COLUMN owner_actor_id TEXT REFERENCES actors(id),
  ADD COLUMN attachment_id TEXT REFERENCES attachments(attachment_id) ON DELETE SET NULL,
  ADD COLUMN idempotency_key TEXT,
  ADD COLUMN request_hash TEXT;

UPDATE greenfield_story_items AS item
SET owner_actor_id = story_group.owner_actor_id
FROM greenfield_story_groups AS story_group
WHERE story_group.group_id = item.group_id;

ALTER TABLE greenfield_story_items
  ALTER COLUMN owner_actor_id SET NOT NULL;

CREATE UNIQUE INDEX greenfield_story_items_attachment_unique
  ON greenfield_story_items(attachment_id)
  WHERE attachment_id IS NOT NULL;

CREATE UNIQUE INDEX greenfield_story_items_idempotency_unique
  ON greenfield_story_items(owner_actor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE greenfield_story_items
  ADD CONSTRAINT greenfield_story_items_idempotency_pair_check
  CHECK ((idempotency_key IS NULL) = (request_hash IS NULL));

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '079')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
