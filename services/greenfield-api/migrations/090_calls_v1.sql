-- 090: 1:1 voice and video calls (CALLS-ARCHITECTURE.md, phase 1).
--
-- PostgreSQL owns call identity, participants, the lifecycle revision, the
-- terminal result and the audit trail. SDP, ICE candidates, IP addresses,
-- TURN credentials and raw tokens are never stored here.

-- ---- calls -------------------------------------------------------------
CREATE TABLE greenfield_calls (
  call_id TEXT PRIMARY KEY CHECK (call_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  conversation_id TEXT NOT NULL REFERENCES greenfield_conversations(conversation_id) ON DELETE CASCADE,
  initiator_actor_id TEXT NOT NULL REFERENCES actors(id),
  recipient_actor_id TEXT NOT NULL REFERENCES actors(id),
  media_kind TEXT NOT NULL CHECK (media_kind IN ('audio', 'video')),
  state TEXT NOT NULL CHECK (state IN ('ringing', 'connecting', 'active', 'reconnecting', 'declined', 'cancelled', 'missed', 'ended', 'failed')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  ring_deadline_at TIMESTAMPTZ NOT NULL,
  -- Deadline of the current non-terminal state (ring, negotiation or reconnect grace).
  state_deadline_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  connected_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  terminal_reason TEXT CHECK (terminal_reason IS NULL OR terminal_reason IN (
    'user_action', 'declined', 'cancelled', 'no_answer', 'negotiation_timeout', 'reconnect_timeout',
    'policy_revoked', 'blocked', 'media_failed', 'busy', 'unavailable'
  )),
  ended_by_actor_id TEXT REFERENCES actors(id),
  accepted_session_id TEXT,
  accepted_device_id TEXT,
  negotiation_id TEXT,
  idempotency_key TEXT NOT NULL CHECK (char_length(idempotency_key) BETWEEN 16 AND 128),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT greenfield_calls_distinct_participants CHECK (initiator_actor_id <> recipient_actor_id),
  CONSTRAINT greenfield_calls_accepted_order CHECK (accepted_at IS NULL OR accepted_at >= created_at),
  CONSTRAINT greenfield_calls_connected_order CHECK (connected_at IS NULL OR (accepted_at IS NOT NULL AND connected_at >= accepted_at)),
  CONSTRAINT greenfield_calls_terminal_shape CHECK (
    (state IN ('declined', 'cancelled', 'missed', 'ended', 'failed')) = (ended_at IS NOT NULL AND terminal_reason IS NOT NULL)
  ),
  CONSTRAINT greenfield_calls_idempotency UNIQUE (initiator_actor_id, idempotency_key)
);

-- At most one non-terminal call per conversation.
CREATE UNIQUE INDEX greenfield_calls_one_live_per_conversation
  ON greenfield_calls (conversation_id)
  WHERE state IN ('ringing', 'connecting', 'active', 'reconnecting');
CREATE INDEX greenfield_calls_deadline_idx
  ON greenfield_calls (state_deadline_at)
  WHERE state IN ('ringing', 'connecting', 'reconnecting');
CREATE INDEX greenfield_calls_initiator_history_idx ON greenfield_calls (initiator_actor_id, created_at DESC, call_id DESC);
CREATE INDEX greenfield_calls_recipient_history_idx ON greenfield_calls (recipient_actor_id, created_at DESC, call_id DESC);
CREATE INDEX greenfield_calls_conversation_history_idx ON greenfield_calls (conversation_id, created_at DESC, call_id DESC);

-- ---- participants --------------------------------------------------------
-- Exactly two rows per call in phase 1, both derived from the direct conversation.
CREATE TABLE greenfield_call_participants (
  call_id TEXT NOT NULL REFERENCES greenfield_calls(call_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  role TEXT NOT NULL CHECK (role IN ('initiator', 'recipient')),
  response TEXT NOT NULL CHECK (response IN ('invited', 'accepted', 'declined')),
  -- TRUE while the call is non-terminal. The partial unique index below is the
  -- database-level "one live call per actor" rule.
  live BOOLEAN NOT NULL DEFAULT TRUE,
  selected_session_id TEXT,
  selected_device_id TEXT,
  media_state TEXT NOT NULL DEFAULT 'none' CHECK (media_state IN ('none', 'connected', 'disconnected')),
  media_negotiation_id TEXT,
  credential_window_started_at TIMESTAMPTZ,
  credential_window_count INTEGER NOT NULL DEFAULT 0,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (call_id, actor_id)
);
CREATE UNIQUE INDEX greenfield_call_participants_one_live_per_actor
  ON greenfield_call_participants (actor_id) WHERE live;

-- ---- append-only lifecycle audit --------------------------------------------
CREATE TABLE greenfield_call_events (
  event_id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES greenfield_calls(call_id) ON DELETE CASCADE,
  revision INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'started', 'accepted', 'declined', 'cancelled', 'missed', 'ended', 'failed',
    'media_connected', 'media_disconnected', 'reconnected'
  )),
  from_state TEXT,
  to_state TEXT NOT NULL,
  actor_id TEXT REFERENCES actors(id),
  session_id TEXT,
  device_id TEXT,
  request_id TEXT,
  idempotency_key TEXT,
  reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT greenfield_call_events_revision UNIQUE (call_id, revision)
);
CREATE UNIQUE INDEX greenfield_call_events_command_idempotency
  ON greenfield_call_events (call_id, actor_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ---- signalling tickets -------------------------------------------------------
-- Single-use, 60-second WebSocket tickets. Only a peppered SHA-256 is stored.
CREATE TABLE greenfield_call_signalling_tickets (
  ticket_id TEXT PRIMARY KEY,
  ticket_hash TEXT NOT NULL UNIQUE CHECK (ticket_hash ~ '^[0-9a-f]{64}$'),
  call_id TEXT NOT NULL REFERENCES greenfield_calls(call_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  session_id TEXT NOT NULL,
  device_id TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX greenfield_call_signalling_tickets_open_idx
  ON greenfield_call_signalling_tickets (call_id, actor_id)
  WHERE consumed_at IS NULL AND revoked_at IS NULL;

-- ---- PushKit VoIP registrations ------------------------------------------------
-- Separate from push_device_tokens: different APNs topic, entitlement and
-- delivery semantics. The token is AES-256-GCM encrypted; lookup uses a hash.
CREATE TABLE greenfield_call_push_tokens (
  registration_id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  device_id TEXT NOT NULL REFERENCES push_device_tokens(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  token_ciphertext BYTEA NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  environment TEXT NOT NULL CHECK (environment IN ('development', 'production')),
  topic TEXT NOT NULL CHECK (char_length(topic) BETWEEN 3 AND 200),
  app_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  disabled_at TIMESTAMPTZ,
  disabled_reason TEXT
);
CREATE UNIQUE INDEX greenfield_call_push_tokens_one_per_device
  ON greenfield_call_push_tokens (device_id) WHERE disabled_at IS NULL;
CREATE INDEX greenfield_call_push_tokens_actor_idx
  ON greenfield_call_push_tokens (actor_id) WHERE disabled_at IS NULL;

-- ---- per-device ring invitations (VoIP push lane) ------------------------------
CREATE TABLE greenfield_call_device_invitations (
  invitation_id TEXT PRIMARY KEY,
  call_id TEXT NOT NULL REFERENCES greenfield_calls(call_id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL REFERENCES actors(id),
  registration_id TEXT NOT NULL REFERENCES greenfield_call_push_tokens(registration_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'cancelled', 'expired')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deadline_at TIMESTAMPTZ NOT NULL,
  leased_until TIMESTAMPTZ,
  apns_id TEXT,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT greenfield_call_device_invitations_identity UNIQUE (call_id, registration_id)
);
CREATE INDEX greenfield_call_device_invitations_due_idx
  ON greenfield_call_device_invitations (next_attempt_at)
  WHERE status = 'queued';

-- ---- call settings ---------------------------------------------------------------
CREATE TABLE greenfield_call_settings (
  actor_id TEXT PRIMARY KEY REFERENCES actors(id),
  incoming_calls TEXT NOT NULL DEFAULT 'accepted_directs' CHECK (incoming_calls IN ('accepted_directs', 'nobody')),
  allow_video BOOLEAN NOT NULL DEFAULT TRUE,
  relay_only BOOLEAN NOT NULL DEFAULT FALSE,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON
  greenfield_calls, greenfield_call_participants, greenfield_call_events, greenfield_call_signalling_tickets,
  greenfield_call_push_tokens, greenfield_call_device_invitations, greenfield_call_settings
  TO modula_api, modula_worker;
GRANT SELECT ON
  greenfield_calls, greenfield_call_participants, greenfield_call_events, greenfield_call_signalling_tickets,
  greenfield_call_push_tokens, greenfield_call_device_invitations, greenfield_call_settings
  TO modula_backup;

INSERT INTO schema_metadata (key, value)
VALUES ('schema_version', '090')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
