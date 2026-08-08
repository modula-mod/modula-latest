# Post Phase 7G Remediation Backlog

Date: 2026-08-08

## NOW

| ID | Area | Problem | Evidence | Priority | Effort | Dependencies | Recommended solution | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P7G-NOW-001 | Code quality | lint failed on main | `pnpm lint` failure | P0 | S | none | fixed segmented hook order and unused import | DONE: `pnpm lint` and `pnpm verify:phase7e-code-quality` PASS |
| P7G-NOW-002 | Auth | new person cannot register live | live `/v1/accounts/register` 403 invite required | P0 | M | invite policy | add documented dev/founder invite path or clear invite UX | register -> verify -> login -> restore proven |
| P7G-NOW-003 | Stories | live API stale | `/v1/stories/rail` 404 | P1 | M | deployment/API parity | deploy/update API or hide Stories when capability missing | Home Stories rail either works or is honestly unavailable |
| P7G-NOW-004 | Verifiers | Standard 2 migration rollback drift | `verify:phase7e-module-runtime-2` expected `027`, got `028` | P1 | S | DB verifier helper | fixed rollback test to unwind to target migration | PARTIAL: isolated Standard 2 test PASS; umbrella still blocked by deployment cutover verifier |
| P7G-NOW-005 | Navigation gate | product shell verifier literal missing | `title: 'Create'` expected | P1 | S | shell adapter | restored explicit title contract without changing behavior | DONE: `verify:phase7c-product-shell` PASS |
| P7G-NOW-006 | Composer | preview tools visible | Composer source and screenshot | P1 | S | product decision | hide/lab-gate fake tools | no visible composer control is preview/local-only |
| P7G-NOW-007 | Reels | major fake/preview route | source local like/save/ranking | P1 | S/M | nav/product prefs | hide/demote Reels or wire real MVP | no fake major product route |

## NEXT

| ID | Area | Problem | Evidence | Priority | Effort | Dependencies | Recommended solution | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P7G-NEXT-001 | Two-account social | counts/security unproven | API routes exist only | P1 | M | valid accounts | script two real dev accounts | follow/post/react/comment/repost/save/block/mute/report survive refresh |
| P7G-NEXT-002 | Product Hub | developer/future info visible | Product Hub routes and registry | P1 | M | module registry state | split user info from diagnostics | ordinary user sees only installable/available modules |
| P7G-NEXT-003 | Board | static future cards risk | Board product data | P1 | M | capability resolver | drive cards from installed/available capabilities | fake CRM/DIMON/Gaia cards absent unless real |
| P7G-NEXT-004 | Vault Notes | product quality unproven | external release + host route | P1 | M/L | installed module account | end-to-end install/edit/autosave/search/trash/export | Vault Notes feels like a notes product, not schema renderer |
| P7G-NEXT-005 | Settings | native semantics incomplete | screenshot/custom rows | P2 | M | Expo UI adapters | migrate sections to List/FieldGroup adapters | Settings rows accessible, dense, native, tokenized |
| P7G-NEXT-006 | Security | boundary matrix pending | security audit doc | P0 | M | valid accounts/tokens | cross-account/API abuse tests | all P0 boundaries pass or block release |
| P7G-NEXT-007 | Worker | running process not proven | worker inventory only | P1 | M | preview env access | inspect worker deployment/queues | retries/dead letters/idempotency proven |

## LATER

| ID | Area | Problem | Evidence | Priority | Effort | Dependencies | Recommended solution | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P7G-LATER-001 | Dependency upgrades | SDK patch drift | Expo Doctor | P2 | M | stable green build | plan SDK patch update separately | Doctor warnings reduced without regressions |
| P7G-LATER-002 | Link previews | composer hardcoded demo link | `demoLink` | P2 | M | SSRF guard proof | real metadata service with SSRF and size gates | no hardcoded preview in product |
| P7G-LATER-003 | Reels full product | route not real | Reels audit | P3 | L | video/engagement backend | build real video feed later | playback, comments, saves, pagination, memory pass |
| P7G-LATER-004 | AI provider smoke | product provider state unproven | AI verifiers only | P2 | M | opt-in provider env | hosted provider smoke opt-in | unavailable state honest; configured provider works |

## REMOVE

| ID | Area | Problem | Evidence | Priority | Effort | Dependencies | Recommended solution | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P7G-REMOVE-001 | Composer | fake major tools | source labels Preview | P1 | S | none | remove/hide GIF/module/location/thread/CW from product toolbar | toolbar has only real/gated controls |
| P7G-REMOVE-002 | Discover | fake trends/recommendations | live/static data | P1 | S/M | product copy | hide trends/topics unless backed by service | Discover has no fake trend claims |
| P7G-REMOVE-003 | Product routes | broad future surfaces | many `src/app/product/*` routes | P2 | M | routing decision | move future surfaces to labs/dev | user nav not overwhelmed by placeholders |

## RESEARCH

| ID | Area | Problem | Evidence | Priority | Effort | Dependencies | Recommended solution | Acceptance criteria |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P7G-RESEARCH-001 | Native performance | blur/reels/feed perf unknown | Linux host blocked | P1 | M | Mac workflow | run simulator and release build measurements | cold start/Home/Reels metrics recorded |
| P7G-RESEARCH-002 | Expo UI Settings | migration scope | Expo UI audit | P2 | M | adapter fixes | prototype one settings section | accessibility and visual improvement proven |
| P7G-RESEARCH-003 | Module Standard production consumption | mutable `file:` links | package.json/external repos | P1 | M | release artifacts | design checksum-pinned consumption | build fails closed on checksum mismatch |
