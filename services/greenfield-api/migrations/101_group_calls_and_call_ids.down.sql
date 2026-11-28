-- 101 down: group calls and call IDs are additive; downgrade removes them.
-- Any group call is deleted first (its participants, events and tickets go
-- with it via CASCADE); direct calls are untouched. Revoked and live call-ID
-- rows are dropped with the table.
DELETE FROM greenfield_calls WHERE kind = 'group';
ALTER TABLE greenfield_calls DROP CONSTRAINT greenfield_calls_kind_shape;
ALTER TABLE greenfield_calls ALTER COLUMN recipient_actor_id SET NOT NULL;
ALTER TABLE greenfield_calls DROP COLUMN max_participants;
ALTER TABLE greenfield_calls DROP COLUMN kind;
ALTER TABLE greenfield_call_participants DROP CONSTRAINT greenfield_call_participants_role_check;
ALTER TABLE greenfield_call_participants ADD CONSTRAINT greenfield_call_participants_role_check
  CHECK (role IN ('initiator', 'recipient'));
DROP TABLE greenfield_call_ids;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '095')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
