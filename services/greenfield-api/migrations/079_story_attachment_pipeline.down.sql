DROP INDEX IF EXISTS greenfield_story_items_idempotency_unique;
DROP INDEX IF EXISTS greenfield_story_items_attachment_unique;

ALTER TABLE greenfield_story_items
  DROP CONSTRAINT IF EXISTS greenfield_story_items_idempotency_pair_check,
  DROP COLUMN IF EXISTS request_hash,
  DROP COLUMN IF EXISTS idempotency_key,
  DROP COLUMN IF EXISTS attachment_id,
  DROP COLUMN IF EXISTS owner_actor_id;

UPDATE schema_metadata SET value = '078', updated_at = NOW() WHERE key = 'schema_version';
