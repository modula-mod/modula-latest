-- Greenfield Backend V1: authoritative trusted-engine registry.
-- Engine code remains in modula-backend-engines; this migration records the
-- exact package provenance and declarations Greenfield is allowed to load.

CREATE TABLE greenfield_engine_registrations (
  engine_id TEXT PRIMARY KEY CHECK (engine_id ~ '^engine\.[a-z][a-z0-9.-]{1,80}$'),
  version TEXT NOT NULL CHECK (version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('IN_PROCESS','SERVICE_FABRIC','CONTRACT_ONLY')),
  runtime_status TEXT NOT NULL CHECK (runtime_status IN ('READY','CONTRACT_ONLY','DISABLED','QUARANTINED')),
  package_name TEXT NOT NULL UNIQUE CHECK (package_name ~ '^@modula/engine-[a-z][a-z0-9-]+$'),
  source_repository TEXT NOT NULL,
  source_revision TEXT NOT NULL CHECK (source_revision ~ '^[a-f0-9]{40}$'),
  trusted_platform BOOLEAN NOT NULL DEFAULT TRUE CHECK (trusted_platform = TRUE),
  health JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(health) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((runtime_status = 'CONTRACT_ONLY') = (execution_mode = 'CONTRACT_ONLY'))
);

CREATE TABLE greenfield_engine_capability_registrations (
  engine_id TEXT NOT NULL REFERENCES greenfield_engine_registrations(engine_id) ON DELETE CASCADE,
  capability TEXT NOT NULL CHECK (capability ~ '^[a-z][a-z0-9.-]{2,120}$'),
  version INTEGER NOT NULL CHECK (version > 0),
  operations JSONB NOT NULL CHECK (jsonb_typeof(operations) = 'array' AND jsonb_array_length(operations) > 0),
  sensitive BOOLEAN NOT NULL,
  availability TEXT NOT NULL CHECK (availability IN ('READY','PROVIDER_REQUIRED','CONTRACT_ONLY')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (engine_id, capability)
);

CREATE TABLE greenfield_engine_service_registrations (
  engine_id TEXT NOT NULL REFERENCES greenfield_engine_registrations(engine_id) ON DELETE CASCADE,
  service_id TEXT PRIMARY KEY CHECK (service_id ~ '^service\.[a-z][a-z0-9.-]{1,100}$'),
  execution_mode TEXT NOT NULL CHECK (execution_mode IN ('IN_PROCESS','SERVICE_FABRIC')),
  audience TEXT NOT NULL CHECK (audience ~ '^modula-engine:[a-z][a-z0-9-]{1,80}$'),
  protocol_version TEXT NOT NULL CHECK (protocol_version ~ '^[0-9]+\.[0-9]+\.[0-9]+$'),
  actions JSONB NOT NULL CHECK (jsonb_typeof(actions) = 'array' AND jsonb_array_length(actions) > 0),
  required_capabilities JSONB NOT NULL CHECK (jsonb_typeof(required_capabilities) = 'array'),
  health_path TEXT NOT NULL CHECK (health_path ~ '^/v1/[A-Za-z0-9_./:-]+$'),
  timeout_ms INTEGER NOT NULL CHECK (timeout_ms BETWEEN 1000 AND 900000),
  tls_required BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (execution_mode <> 'SERVICE_FABRIC' OR tls_required = TRUE)
);

CREATE TABLE greenfield_engine_job_registrations (
  engine_id TEXT NOT NULL REFERENCES greenfield_engine_registrations(engine_id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action ~ '^[a-z][a-z0-9.-]{2,180}\.v[1-9][0-9]*$'),
  version INTEGER NOT NULL CHECK (version > 0),
  timeout_seconds INTEGER NOT NULL CHECK (timeout_seconds BETWEEN 1 AND 900),
  maximum_attempts INTEGER NOT NULL CHECK (maximum_attempts BETWEEN 1 AND 20),
  active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (engine_id, action)
);

CREATE TABLE greenfield_engine_event_consumer_registrations (
  engine_id TEXT NOT NULL REFERENCES greenfield_engine_registrations(engine_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type ~ '^[a-z][a-z0-9.-]{2,180}\.v[1-9][0-9]*$'),
  schema_version INTEGER NOT NULL CHECK (schema_version > 0),
  active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (engine_id, event_type, schema_version)
);

CREATE TABLE greenfield_engine_usage_metric_registrations (
  engine_id TEXT NOT NULL REFERENCES greenfield_engine_registrations(engine_id) ON DELETE CASCADE,
  metric TEXT NOT NULL CHECK (metric ~ '^[a-z][a-z0-9.-]{2,120}$'),
  active BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (engine_id, metric)
);

CREATE OR REPLACE FUNCTION greenfield_engine_service_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  engine_mode TEXT;
  engine_status TEXT;
BEGIN
  SELECT execution_mode, runtime_status INTO engine_mode, engine_status
  FROM greenfield_engine_registrations WHERE engine_id = NEW.engine_id;
  IF engine_status <> 'READY' THEN
    RAISE EXCEPTION 'only READY trusted engines may register an active service';
  END IF;
  IF engine_mode <> NEW.execution_mode THEN
    RAISE EXCEPTION 'engine and service execution modes must match';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER greenfield_engine_service_guard
  BEFORE INSERT OR UPDATE OF engine_id, execution_mode
  ON greenfield_engine_service_registrations
  FOR EACH ROW EXECUTE FUNCTION greenfield_engine_service_guard();

CREATE OR REPLACE FUNCTION greenfield_engine_activation_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.active AND NOT EXISTS (
    SELECT 1 FROM greenfield_engine_registrations
    WHERE engine_id = NEW.engine_id AND runtime_status = 'READY'
  ) THEN
    RAISE EXCEPTION 'only READY trusted engines may activate jobs, event consumers or usage metrics';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER greenfield_engine_job_activation_guard
  BEFORE INSERT OR UPDATE OF engine_id, active ON greenfield_engine_job_registrations
  FOR EACH ROW EXECUTE FUNCTION greenfield_engine_activation_guard();
CREATE TRIGGER greenfield_engine_event_activation_guard
  BEFORE INSERT OR UPDATE OF engine_id, active ON greenfield_engine_event_consumer_registrations
  FOR EACH ROW EXECUTE FUNCTION greenfield_engine_activation_guard();
CREATE TRIGGER greenfield_engine_metric_activation_guard
  BEFORE INSERT OR UPDATE OF engine_id, active ON greenfield_engine_usage_metric_registrations
  FOR EACH ROW EXECUTE FUNCTION greenfield_engine_activation_guard();

INSERT INTO greenfield_engine_registrations
  (engine_id, version, execution_mode, runtime_status, package_name, source_repository, source_revision, health)
VALUES
  ('engine.ai','1.0.0','SERVICE_FABRIC','READY','@modula/engine-ai','modula-mod/modula-backend-engines','a5511d3065326e5b29f0ab786a6975921b9db286','{"livePath":"/v1/health/live","readyPath":"/v1/health/ready","dependencyIds":["service.modula-secrets"]}'),
  ('engine.search','1.0.0','IN_PROCESS','READY','@modula/engine-search','modula-mod/modula-backend-engines','a5511d3065326e5b29f0ab786a6975921b9db286','{"livePath":"/v1/health/live","readyPath":"/v1/admin/ops/search/health","dependencyIds":["greenfield-postgres","greenfield-worker"]}'),
  ('engine.media','1.0.0','IN_PROCESS','READY','@modula/engine-media','modula-mod/modula-backend-engines','a5511d3065326e5b29f0ab786a6975921b9db286','{"livePath":"/v1/health/live","readyPath":"/v1/health/ready","dependencyIds":["greenfield-postgres","object-storage"]}'),
  ('engine.notifications','1.0.0','IN_PROCESS','READY','@modula/engine-notifications','modula-mod/modula-backend-engines','a5511d3065326e5b29f0ab786a6975921b9db286','{"livePath":"/v1/health/live","readyPath":"/v1/health/ready","dependencyIds":["greenfield-postgres","greenfield-worker"]}'),
  ('engine.files','1.0.0','CONTRACT_ONLY','CONTRACT_ONLY','@modula/engine-files','modula-mod/modula-backend-engines','a5511d3065326e5b29f0ab786a6975921b9db286','{"livePath":null,"readyPath":null,"dependencyIds":[]}'),
  ('engine.realtime','1.0.0','CONTRACT_ONLY','CONTRACT_ONLY','@modula/engine-realtime','modula-mod/modula-backend-engines','a5511d3065326e5b29f0ab786a6975921b9db286','{"livePath":null,"readyPath":null,"dependencyIds":[]}'),
  ('engine.automation','1.0.0','CONTRACT_ONLY','CONTRACT_ONLY','@modula/engine-automation','modula-mod/modula-backend-engines','a5511d3065326e5b29f0ab786a6975921b9db286','{"livePath":null,"readyPath":null,"dependencyIds":[]}'),
  ('engine.entitlements','1.0.0','CONTRACT_ONLY','CONTRACT_ONLY','@modula/engine-entitlements','modula-mod/modula-backend-engines','a5511d3065326e5b29f0ab786a6975921b9db286','{"livePath":null,"readyPath":null,"dependencyIds":[]}'),
  ('engine.avatar','1.0.0','CONTRACT_ONLY','CONTRACT_ONLY','@modula/engine-avatar','modula-mod/modula-backend-engines','a5511d3065326e5b29f0ab786a6975921b9db286','{"livePath":null,"readyPath":null,"dependencyIds":[]}'),
  ('engine.game-services','1.0.0','CONTRACT_ONLY','CONTRACT_ONLY','@modula/engine-game-services','modula-mod/modula-backend-engines','a5511d3065326e5b29f0ab786a6975921b9db286','{"livePath":null,"readyPath":null,"dependencyIds":[]}');

INSERT INTO greenfield_engine_capability_registrations (engine_id, capability, version, operations, sensitive, availability)
SELECT engine_id, capability, 1, jsonb_build_array(capability), sensitive, availability
FROM (VALUES
  ('engine.ai','ai.generate',TRUE,'PROVIDER_REQUIRED'),('engine.ai','ai.structured',TRUE,'PROVIDER_REQUIRED'),('engine.ai','ai.embed',TRUE,'PROVIDER_REQUIRED'),('engine.ai','ai.health',FALSE,'READY'),
  ('engine.search','search.lexical',TRUE,'READY'),('engine.search','search.full-text',TRUE,'READY'),('engine.search','search.semantic',TRUE,'PROVIDER_REQUIRED'),('engine.search','search.health',FALSE,'READY'),
  ('engine.media','media.metadata',TRUE,'READY'),('engine.media','media.retrieve',TRUE,'READY'),('engine.media','media.compress',TRUE,'READY'),('engine.media','media.thumbnail',TRUE,'READY'),('engine.media','media.transcode',TRUE,'CONTRACT_ONLY'),
  ('engine.notifications','notifications.declare',FALSE,'READY'),('engine.notifications','notifications.in-app',TRUE,'READY'),('engine.notifications','notifications.push',TRUE,'PROVIDER_REQUIRED'),('engine.notifications','notifications.email',TRUE,'PROVIDER_REQUIRED'),
  ('engine.files','files.identity',TRUE,'CONTRACT_ONLY'),('engine.files','files.upload',TRUE,'CONTRACT_ONLY'),('engine.files','files.download',TRUE,'CONTRACT_ONLY'),('engine.files','files.signed-access',TRUE,'CONTRACT_ONLY'),('engine.files','files.retention',TRUE,'CONTRACT_ONLY'),
  ('engine.realtime','realtime.presence',TRUE,'CONTRACT_ONLY'),('engine.realtime','realtime.rooms',TRUE,'CONTRACT_ONLY'),('engine.realtime','realtime.subscribe',TRUE,'CONTRACT_ONLY'),('engine.realtime','realtime.collaboration',TRUE,'CONTRACT_ONLY'),('engine.realtime','realtime.multiplayer-signal',TRUE,'CONTRACT_ONLY'),
  ('engine.automation','automation.trigger',TRUE,'CONTRACT_ONLY'),('engine.automation','automation.condition',TRUE,'CONTRACT_ONLY'),('engine.automation','automation.action',TRUE,'CONTRACT_ONLY'),('engine.automation','automation.schedule',TRUE,'CONTRACT_ONLY'),('engine.automation','automation.function.invoke',TRUE,'CONTRACT_ONLY'),
  ('engine.entitlements','entitlements.read',TRUE,'CONTRACT_ONLY'),('engine.entitlements','entitlements.grant',TRUE,'CONTRACT_ONLY'),('engine.entitlements','entitlements.revoke',TRUE,'CONTRACT_ONLY'),('engine.entitlements','entitlements.usage',TRUE,'CONTRACT_ONLY'),('engine.entitlements','entitlements.quota',TRUE,'CONTRACT_ONLY'),
  ('engine.avatar','avatar.state',TRUE,'CONTRACT_ONLY'),('engine.avatar','avatar.render',TRUE,'CONTRACT_ONLY'),('engine.avatar','avatar.assets',TRUE,'CONTRACT_ONLY'),('engine.avatar','avatar.permissions',TRUE,'CONTRACT_ONLY'),
  ('engine.game-services','game.profile',TRUE,'CONTRACT_ONLY'),('engine.game-services','game.session',TRUE,'CONTRACT_ONLY'),('engine.game-services','game.save',TRUE,'CONTRACT_ONLY'),('engine.game-services','game.lobby',TRUE,'CONTRACT_ONLY'),('engine.game-services','game.matchmaking',TRUE,'CONTRACT_ONLY'),('engine.game-services','game.leaderboard',TRUE,'CONTRACT_ONLY'),('engine.game-services','game.achievement',TRUE,'CONTRACT_ONLY'),('engine.game-services','game.inventory',TRUE,'CONTRACT_ONLY'),('engine.game-services','game.entitlement',TRUE,'CONTRACT_ONLY'),('engine.game-services','game.events',TRUE,'CONTRACT_ONLY')
) AS capability_seed(engine_id, capability, sensitive, availability);

UPDATE greenfield_engine_capability_registrations SET operations='["query","suggest"]' WHERE engine_id='engine.search' AND capability='search.lexical';
UPDATE greenfield_engine_capability_registrations SET operations='["query","index","reindex"]' WHERE engine_id='engine.search' AND capability='search.full-text';
UPDATE greenfield_engine_capability_registrations SET operations='["query","index"]' WHERE engine_id='engine.search' AND capability='search.semantic';
UPDATE greenfield_engine_capability_registrations SET operations='["read"]' WHERE engine_id='engine.search' AND capability='search.health';
UPDATE greenfield_engine_capability_registrations SET operations='["read","extract"]' WHERE engine_id='engine.media' AND capability='media.metadata';
UPDATE greenfield_engine_capability_registrations SET operations='["read"]' WHERE engine_id='engine.media' AND capability='media.retrieve';
UPDATE greenfield_engine_capability_registrations SET operations='["image.compress"]' WHERE engine_id='engine.media' AND capability='media.compress';
UPDATE greenfield_engine_capability_registrations SET operations='["image.thumbnail"]' WHERE engine_id='engine.media' AND capability='media.thumbnail';
UPDATE greenfield_engine_capability_registrations SET operations='["video.transcode","audio.transcode"]' WHERE engine_id='engine.media' AND capability='media.transcode';
UPDATE greenfield_engine_capability_registrations SET operations='["declare"]' WHERE engine_id='engine.notifications' AND capability='notifications.declare';
UPDATE greenfield_engine_capability_registrations SET operations='["deliver"]' WHERE engine_id='engine.notifications' AND capability IN ('notifications.in-app','notifications.push','notifications.email');

INSERT INTO greenfield_engine_service_registrations
  (engine_id, service_id, execution_mode, audience, protocol_version, actions, required_capabilities, health_path, timeout_ms, tls_required)
VALUES
  ('engine.ai','service.modula-ai','SERVICE_FABRIC','modula-engine:ai','1.0.0','["completion.create","structured.create","embedding.create","providers.health"]','["ai.generate","ai.structured","ai.embed","ai.health"]','/v1/health/ready',120000,TRUE),
  ('engine.search','service.greenfield-search','IN_PROCESS','modula-engine:search','1.0.0','["search.query","search.suggest","search.reindex","search.health"]','["search.lexical","search.full-text","search.semantic","search.health"]','/v1/admin/ops/search/health',30000,FALSE),
  ('engine.media','service.greenfield-media','IN_PROCESS','modula-engine:media','1.0.0','["media.metadata","media.retrieve","media.compress","media.thumbnail"]','["media.metadata","media.retrieve","media.compress","media.thumbnail"]','/v1/health/ready',120000,FALSE),
  ('engine.notifications','service.greenfield-notifications','IN_PROCESS','modula-engine:notifications','1.0.0','["notifications.declare","notifications.deliver"]','["notifications.declare","notifications.in-app"]','/v1/health/ready',30000,FALSE);

INSERT INTO greenfield_engine_job_registrations (engine_id, action, version, timeout_seconds, maximum_attempts, active) VALUES
  ('engine.ai','ai.embedding.batch.v1',1,300,3,TRUE),
  ('engine.search','search.reindex.v1',1,900,3,TRUE),
  ('engine.media','media.thumbnail.v1',1,120,3,TRUE),
  ('engine.media','media.transcode.v1',1,900,3,FALSE),
  ('engine.notifications','notifications.deliver.v1',1,120,5,TRUE),
  ('engine.automation','automation.execute.v1',1,300,3,FALSE),
  ('engine.avatar','avatar.render.v1',1,900,3,FALSE),
  ('engine.game-services','game.matchmaking.v1',1,300,3,FALSE);

INSERT INTO greenfield_engine_event_consumer_registrations (engine_id, event_type, schema_version, active) VALUES
  ('engine.ai','ai.provider.rotation.requested.v1',1,TRUE),
  ('engine.search','social.post.created.v1',1,TRUE),('engine.search','profile.updated.v1',1,TRUE),('engine.search','module.release.published.v1',1,TRUE),('engine.search','vault.note.updated.v1',1,TRUE),
  ('engine.media','asset.upload.completed.v1',1,TRUE),
  ('engine.notifications','notification.requested.v1',1,TRUE),('engine.notifications','security.notification.requested.v1',1,TRUE),
  ('engine.automation','automation.triggered.v1',1,FALSE),
  ('engine.entitlements','entitlement.changed.v1',1,FALSE),
  ('engine.game-services','game.session.completed.v1',1,FALSE);

INSERT INTO greenfield_engine_usage_metric_registrations (engine_id, metric, active) VALUES
  ('engine.ai','ai.request',TRUE),('engine.ai','ai.tokens',TRUE),
  ('engine.search','search.request',TRUE),('engine.search','search.document.indexed',TRUE),
  ('engine.media','media.processing',TRUE),('engine.media','media.output.bytes',TRUE),
  ('engine.notifications','notifications.delivery',TRUE),
  ('engine.files','storage.bytes',FALSE),('engine.realtime','realtime.connection.seconds',FALSE),('engine.automation','function.invocation',FALSE),('engine.entitlements','entitlement.check',FALSE),('engine.avatar','render.time',FALSE),('engine.game-services','game.session',FALSE);

GRANT SELECT ON greenfield_engine_registrations, greenfield_engine_capability_registrations,
  greenfield_engine_service_registrations, greenfield_engine_job_registrations,
  greenfield_engine_event_consumer_registrations, greenfield_engine_usage_metric_registrations
  TO modula_api, modula_worker, modula_backup;

INSERT INTO schema_metadata (key, value) VALUES ('schema_version', '044')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=NOW();
