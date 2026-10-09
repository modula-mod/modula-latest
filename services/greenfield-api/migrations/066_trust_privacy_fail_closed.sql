-- API-FIX-01 trust, ownership and privacy hardening.
-- Follow rows continue to mean accepted relationships only. Requests are kept
-- separately so an absent approval can never satisfy existing follower checks.

CREATE TABLE follow_requests (
  request_id TEXT PRIMARY KEY,
  requester_actor_id TEXT NOT NULL REFERENCES actors(id),
  target_actor_id TEXT NOT NULL REFERENCES actors(id),
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
  CONSTRAINT follow_requests_not_self CHECK (requester_actor_id <> target_actor_id),
  UNIQUE (requester_actor_id, target_actor_id)
);

CREATE INDEX follow_requests_target_pending_idx
  ON follow_requests (target_actor_id, created_at DESC, request_id DESC)
  WHERE status = 'PENDING';
CREATE INDEX follow_requests_requester_pending_idx
  ON follow_requests (requester_actor_id, created_at DESC, request_id DESC)
  WHERE status = 'PENDING';

GRANT SELECT, INSERT, UPDATE ON follow_requests TO modula_api;
GRANT SELECT ON follow_requests TO modula_worker, modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '066')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
