# Phase 7G Database Audit

Date: 2026-08-08
Source: `services/greenfield-api/migrations`.

No destructive migration was run during this audit.

## Migration Inventory

| Migration | Purpose | Tables / areas | Rollback present | Current usage | Status |
| --- | --- | --- | --- | --- | --- |
| `001_init_schema` | initial accounts/profiles/posts/session foundations | core social/auth | yes | active | `IN_USE` |
| `002_phase6_social_atproto` | Atproto social bridge | atproto/bridge | yes | active optional | `IN_USE` |
| `003_phase6_api_rls_writes` | write policy hardening | API/RLS style writes | yes | active | `IN_USE` |
| `004_greenfield_sovereign_core` | Greenfield core records | repository/records | yes | active | `IN_USE` |
| `005_greenfield_backup_access` | backup/access support | backup/access | yes | active | `IN_USE` |
| `006_phase6s_social_product` | social product completion | posts/comments/social | yes | active | `IN_USE` |
| `007_phase6s_backfill_counts_and_defaults` | social count backfill | post/profile counts | yes | active | `IN_USE` |
| `008_phase6s_comment_reply_counter_consistency` | counter repair | comments/replies | yes | active | `IN_USE` |
| `009_phase7a_module_platform` | module platform base | modules/registry/install | yes | active | `IN_USE` |
| `010_phase7b_module_runtime` | module host/runtime | runtime/views/records | yes | active | `IN_USE` |
| `011_phase7c_restrained_reactions` | reaction model | reactions | yes | active | `IN_USE` |
| `012_phase7c_board_layout` | board layout prefs | board layout | yes | active | `IN_USE` |
| `013_phase7c_notification_preferences` | notification prefs | notifications prefs | yes | active | `IN_USE` |
| `014_phase7c_account_actor_backfill` | account/profile actor linkage | accounts/profiles | yes | active | `IN_USE` |
| `015_phase7d_runtime_sessions` | runtime sessions | runtime session tables | yes | active | `IN_USE` |
| `016_phase7d_connector_foundation` | connector foundation | connectors | yes | active | `IN_USE` |
| `017_phase7d_connector_security_lifecycle` | connector lifecycle/security | connectors/security | yes | active | `IN_USE` |
| `018_phase7e_internal_events` | internal events substrate | event tables | yes | active | `IN_USE` |
| `019_phase7e_event_platform` | event delivery/outbox | events/outbox/jobs | yes | active | `IN_USE` |
| `020_phase7e_policy_audit_notifications` | policy/audit/notifications | policy/audit/notifications | yes | active | `IN_USE` |
| `021_phase7e_unified_search` | search documents | search | yes | active | `IN_USE` |
| `022_phase7e_module_records_and_vault_notes` | module records and Vault Notes integration | module records/vault search | yes | active | `IN_USE` |
| `023_phase7e_module_backend_runtime` | module backend runtime | backend health/events | yes | active | `IN_USE` |
| `024_phase7e_ai_platform_foundation` | AI provider/model/execution base | AI tables | yes | active | `IN_USE` |
| `025_phase7e_ai_provider_runtime` | provider runtime | AI provider runtime/health | yes | active | `IN_USE` |
| `026_phase7e_ai_product_actions` | AI product actions | action requests/apply/audit | yes | active | `IN_USE` |
| `027_phase7e_module_runtime_2` | Standard 2 runtime support | dependency graph/capabilities/services/hooks/jobs/ui | yes | active | `IN_USE`; umbrella verifier drift |
| `028_phase7f_stories` | Stories | story groups/items/views/media | yes | app code present | `PARTIAL`; live API not deployed |

## Observed Database Risks

| Risk | Priority | Evidence | Recommendation |
| --- | --- | --- | --- |
| Verifier rollback drift after migration `028` | P1 | `verify:phase7e-module-runtime-2` expected rollback target `027` to be latest, got `028` | update verifier rollback to unwind to target migration |
| JSONB serialization sensitivity | P1 | recurring project pattern; module runtime uses JSON-heavy declarations | keep explicit serialization in service writes |
| Module runtime breadth | P1 | Standard 2 declarations create many runtime tables | support matrix must distinguish declared vs operational |
| Search/document tables | P1 | DB verifiers env-blocked without `MODULA_TEST_DATABASE_URL` | rerun with repo-local DB env |
| Story media | P1 | migration exists, app source can read local URI via `fetch` | verify upload storage, MIME, size, expiry cleanup |
| Event/outbox/worker idempotency | P1 | worker source exists but process not proven running | run worker tests and live/preview process checks |
| AI quota/ledger tables | P1 | AI verifiers pass but product provider unavailable path pending | keep provider-neutral and append-only usage records |

## Database Verdict

The schema history is coherent and rollback files exist for every migration. Cleanup is not allowed in this stage. The immediate database remediation is verifier compatibility and proof with a real test database, not schema deletion.
