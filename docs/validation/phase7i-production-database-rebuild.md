# Phase 7I Production Database Rebuild

Date: 2026-08-09

Status: source/test gate only. No production database rebuild or production migration was performed in this checkpoint.

Disposable test database:

- Container: `modula-phase7i-test-postgres`
- Image: `postgres:16.9-alpine`
- Database: `phase7i_test`
- Binding: `127.0.0.1:55433 -> 5432`
- Storage: container tmpfs
- External exposure: none; loopback only
- Secrets: generated locally, stored outside Git for test execution only

Migration command:

```sh
pnpm --filter @modula/greenfield-api db:migrate
```

Test database status after migration:

```text
pending: []
```

Current preview production-read status:

- Source container inspected read-only: `modula-preview-greenfield-postgres-1`
- Applied there at this checkpoint: `001` through `021`
- Not applied there yet: `022` through `029`
- Reason: production maintenance/rebuild window has not started.

| Migration | Purpose | Rollback available | Preview applied | Test applied |
| --- | --- | --- | --- | --- |
| `001_init_schema` | Initial Greenfield schema | yes | yes | yes |
| `002_phase6_social_atproto` | Phase 6 social and AT Protocol schema | yes | yes | yes |
| `003_phase6_api_rls_writes` | API RLS write policies | yes | yes | yes |
| `004_greenfield_sovereign_core` | Greenfield sovereign account core | yes | yes | yes |
| `005_greenfield_backup_access` | Backup access role/policy support | yes | yes | yes |
| `006_phase6s_social_product` | Phase 6S social product tables | yes | yes | yes |
| `007_phase6s_backfill_counts_and_defaults` | Social count/default backfills | yes | yes | yes |
| `008_phase6s_comment_reply_counter_consistency` | Comment/reply counter consistency | yes | yes | yes |
| `009_phase7a_module_platform` | Module platform registry foundation | yes | yes | yes |
| `010_phase7b_module_runtime` | Module runtime persistence | yes | yes | yes |
| `011_phase7c_restrained_reactions` | Restrained reaction model | yes | yes | yes |
| `012_phase7c_board_layout` | Board layout persistence | yes | yes | yes |
| `013_phase7c_notification_preferences` | Notification preferences | yes | yes | yes |
| `014_phase7c_account_actor_backfill` | Account actor backfill | yes | yes | yes |
| `015_phase7d_runtime_sessions` | Runtime session persistence | yes | yes | yes |
| `016_phase7d_connector_foundation` | Connector foundation | yes | yes | yes |
| `017_phase7d_connector_security_lifecycle` | Connector security and lifecycle | yes | yes | yes |
| `018_phase7e_internal_events` | Internal event substrate | yes | yes | yes |
| `019_phase7e_event_platform` | Event platform | yes | yes | yes |
| `020_phase7e_policy_audit_notifications` | Policy, audit, and notification foundations | yes | yes | yes |
| `021_phase7e_unified_search` | Unified search | yes | yes | yes |
| `022_phase7e_module_records_and_vault_notes` | Module records and Vault Notes data | yes | no | yes |
| `023_phase7e_module_backend_runtime` | Module backend runtime | yes | no | yes |
| `024_phase7e_ai_platform_foundation` | Provider-neutral AI platform foundation | yes | no | yes |
| `025_phase7e_ai_provider_runtime` | AI provider runtime | yes | no | yes |
| `026_phase7e_ai_product_actions` | AI product actions | yes | no | yes |
| `027_phase7e_module_runtime_2` | Standard 2 runtime tables | yes | no | yes |
| `028_phase7f_stories` | Stories runtime | yes | no | yes |
| `029_phase7h_mail` | Transactional mail jobs | yes | no | yes |
