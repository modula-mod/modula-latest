# Phase 7E Block 11 Isolated Environment

Date: 2026-08-01
Environment identity: `phase7e-block11-product`
Execution host: VPS/Linux
Production deployment: prohibited and not performed
Mac/iOS acceptance: not started

## Services

- PostgreSQL: running in `modula-preview-greenfield-postgres-1`, exposed on `127.0.0.1:5433`.
- API: not production-deployed by this block. Local acceptance API should run on `127.0.0.1:4120`.
- Worker: not production-deployed by this block. Use the same isolated database when running worker acceptance.
- Object storage: not completed for Block 11 acceptance; media pipeline remains incomplete.
- SMTP: not completed for Block 11 acceptance; current development recovery/verification tests use stored tokens, not a real SMTP sink.
- Redis/queue: current Greenfield worker uses database-backed outbox/job tables; no separate Redis service was configured in this slice.
- AI provider: not configured for product acceptance. Deterministic provider is now gated to `NODE_ENV=test` only.

## Isolated Database

- Database: `modula_phase7e_block11_product`
- Roles:
  - `modula_block11_migrator`
  - `modula_block11_api`
  - `modula_block11_worker`
- Credential storage: generated non-production credentials are held in `/tmp/modula-phase7e-block11-db.env` with mode `0600`. Values are not printed, committed, or copied into docs.
- Production data: none used.
- Production session keys/OAuth secrets/AI credentials: none used.

## Migration Evidence

Acceptance database migration command:

```text
pnpm --filter @modula/greenfield-api db:migrate
```

Result:

```json
{
  "applied": [
    "001_init_schema",
    "002_phase6_social_atproto",
    "003_phase6_api_rls_writes",
    "004_greenfield_sovereign_core",
    "005_greenfield_backup_access",
    "006_phase6s_social_product",
    "007_phase6s_backfill_counts_and_defaults",
    "008_phase6s_comment_reply_counter_consistency",
    "009_phase7a_module_platform",
    "010_phase7b_module_runtime",
    "011_phase7c_restrained_reactions",
    "012_phase7c_board_layout",
    "013_phase7c_notification_preferences",
    "014_phase7c_account_actor_backfill",
    "015_phase7d_runtime_sessions",
    "016_phase7d_connector_foundation",
    "017_phase7d_connector_security_lifecycle",
    "018_phase7e_internal_events",
    "019_phase7e_event_platform",
    "020_phase7e_policy_audit_notifications",
    "021_phase7e_unified_search",
    "022_phase7e_module_records_and_vault_notes",
    "023_phase7e_module_backend_runtime",
    "024_phase7e_ai_platform_foundation",
    "025_phase7e_ai_provider_runtime",
    "026_phase7e_ai_product_actions"
  ]
}
```

Disposable rollback database: `modula_phase7e_block11_rollback`

Rollback proof:

```json
{
  "appliedCount": 26,
  "firstApplied": "001_init_schema",
  "lastApplied": "026_phase7e_ai_product_actions",
  "rolledBackCount": 26,
  "firstRolledBack": "026_phase7e_ai_product_actions",
  "lastRolledBack": "001_init_schema"
}
```

The disposable rollback database was dropped after the proof. The isolated acceptance database remains in place.

## Runtime Commands

Run API against the isolated database:

```text
set -a
. /tmp/modula-phase7e-block11-db.env
set +a
export NODE_ENV=development
export MODULA_ENVIRONMENT=development
export MODULA_API_HOST=127.0.0.1
export MODULA_API_PORT=4120
export MODULA_PUBLIC_API_URL=http://127.0.0.1:4120
export MODULA_ALLOWED_ORIGINS=http://127.0.0.1:8081,http://localhost:8081,http://127.0.0.1:19006,http://localhost:19006
export MODULA_DATABASE_URL="postgresql://modula_block11_api:${MODULA_BLOCK11_API_PASSWORD}@127.0.0.1:5433/modula_phase7e_block11_product"
export MODULA_DATABASE_MIGRATOR_URL="postgresql://modula_block11_migrator:${MODULA_BLOCK11_MIGRATOR_PASSWORD}@127.0.0.1:5433/modula_phase7e_block11_product"
export MODULA_PREVIEW_WRITES_ENABLED=true
export MODULA_INVITE_ONLY=false
export GREENFIELD_MODULE_REGISTRY_ENABLED=true
export GREENFIELD_MODULE_INSTALLATION_ENABLED=true
export GREENFIELD_MODULE_DECLARATIVE_CONTRIBUTIONS_ENABLED=true
export GREENFIELD_VAULT_NOTES_REFERENCE_ENABLED=true
export GREENFIELD_AI_GATEWAY_ENABLED=true
pnpm --filter @modula/greenfield-api dev
```

Run web against the isolated API:

```text
export EXPO_PUBLIC_APP_ENV=development
export EXPO_PUBLIC_DATA_SOURCE=remote
export EXPO_PUBLIC_API_URL=http://127.0.0.1:4120
export EXPO_PUBLIC_DEMO_SESSION=signedOut
pnpm web
```

## Verification Completed

```text
pnpm verify:phase7e-real-auth
pnpm --filter @modula/greenfield-api typecheck
pnpm typecheck
pnpm verify:phase7e-no-product-mocks
```

Results:

- `pnpm verify:phase7e-real-auth`: passed.
- `pnpm --filter @modula/greenfield-api typecheck`: passed.
- `pnpm typecheck`: passed.
- `pnpm verify:phase7e-no-product-mocks`: initially failed on 29 remaining product-visible demo/seed/fake-refresh issues; superseded by `docs/validation/phase7e-block11-no-product-mocks-recovery.md`, where the verifier passes.

## Blockers

- Product no-mock gate is still red.
- Web acceptance has not been captured yet. The no-product-mocks gate is now green in `docs/validation/phase7e-block11-no-product-mocks-recovery.md`; browser acceptance remains separate evidence.
- Real SMTP acceptance is blocked until SMTP transport/sink is configured and wired.
- Real AI product acceptance is `BLOCKED_BY_PROVIDER_CONFIGURATION` until OpenAI/Ollama/another real provider is configured and healthy.
- Phase 7F Mac/iOS acceptance has not been executed.
