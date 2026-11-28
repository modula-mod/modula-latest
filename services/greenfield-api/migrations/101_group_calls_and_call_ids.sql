-- 101: group calls (mesh, cap 6) and dialable call IDs.
--
-- Group calls live on group conversations. A group call has no single
-- recipient, so recipient_actor_id becomes nullable and the call carries its
-- kind and participant cap. Acceptance, media state and seats live on the
-- participant rows, which already express them.
-- Call IDs are one live 8-digit dialable code per account (displayed as
-- "1234 5678"), allocated randomly, never sequential, never reissued.

-- ---- calls: kind + nullable recipient --------------------------------------
ALTER TABLE greenfield_calls
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct', 'group')),
  ADD COLUMN max_participants INTEGER NOT NULL DEFAULT 2 CHECK (max_participants BETWEEN 2 AND 8);
ALTER TABLE greenfield_calls ALTER COLUMN recipient_actor_id DROP NOT NULL;
ALTER TABLE greenfield_calls ADD CONSTRAINT greenfield_calls_kind_shape CHECK (
  (kind = 'direct' AND recipient_actor_id IS NOT NULL AND max_participants = 2)
  OR (kind = 'group' AND recipient_actor_id IS NULL AND max_participants BETWEEN 3 AND 8)
);

-- ---- participants: group role ------------------------------------------------
ALTER TABLE greenfield_call_participants DROP CONSTRAINT greenfield_call_participants_role_check;
ALTER TABLE greenfield_call_participants ADD CONSTRAINT greenfield_call_participants_role_check
  CHECK (role IN ('initiator', 'recipient', 'participant'));

-- ---- call IDs ------------------------------------------------------------------
-- One live code per account; revoked codes stay reserved forever so a printed
-- or old code never silently reaches a different person.
CREATE TABLE greenfield_call_ids (
  code TEXT PRIMARY KEY CHECK (code ~ '^[1-9][0-9]{7}$'),
  actor_id TEXT NOT NULL REFERENCES actors(id),
  account_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT CHECK (revoked_reason IS NULL OR revoked_reason IN ('user_removed'))
);
CREATE UNIQUE INDEX greenfield_call_ids_one_live_per_actor
  ON greenfield_call_ids (actor_id) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON greenfield_call_ids TO modula_api, modula_worker;
GRANT SELECT ON greenfield_call_ids TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '101')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
