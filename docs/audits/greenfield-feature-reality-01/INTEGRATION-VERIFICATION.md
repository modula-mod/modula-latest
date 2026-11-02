# GREENFIELD FEATURE REALITY 01 — non-merged integration verification

Mission: `GREENFIELD-FEATURE-REALITY-01`

Recorded: 2026-11-02

Overall mission status: **PARTIAL**

Disposable backend composition: **PASS**

## Conclusion

The seven executable backend workstreams coexist on the current mission baseline and pass the persisted cross-feature suite. This is source-composition and isolated PostgreSQL evidence, not Native, physical-device, StoreKit live-sandbox, merged-main, deployed-QA or production acceptance.

No workstream branch was merged to another source branch for this test. A detached, local-only composition was built from the exact refs below, tested, and left unpushed. PR-08 is documentation-only and was reviewed independently; it adds no runtime code to compose.

The first composition run correctly failed one of 89 tests: PR-01 migration 084 had retained the existing web-runtime package media type but omitted the already-shipped GUBIC game-web media type. PR-01 was fixed at `376c96c7dceef41c284b00d53ee59e2fbbc619e6`, its real signed external-game import and canonical up/down tests passed, and the corrected exact ref was recomposed. The final clean-database run passed 89/89.

## Exact refs

| Workstream | Draft PR | Ref tested | Runtime composition |
| --- | --- | --- | --- |
| PR-01 Moliboo signed packs and stickers | #147 | `376c96c7dceef41c284b00d53ee59e2fbbc619e6` | Included |
| PR-02 direct conversation creation | #148 | `d99c1470df6e5b9aff8f6bb02174120fcd7bc9b5` | Included |
| PR-03 story replies into DMs | #149 | `2826b31c3412203514f2113c81cf1c645e718513` | Included |
| PR-04 Communities | #150 | `2d2588416aa0dbcdecc81c1adea7e85cf1058e87` | Included |
| PR-05 Collections and Drafts | #151 | `2525cea3bf5e803a207fbe01474fae80ea477a54` | Included |
| PR-06 Vault Notes install verification | #157 | `753c3cbcec9f6596351cbe6823969a850fdac493` | Included |
| PR-07 Premium QA | #158 | `d961481f68a8412a5e18a594f6355711ba67ebc0` | Included |
| PR-08 Calls design | #159 | `8dec6bb53a58d92fe442a5684749720aca0193b6` | Not applicable; documentation only |

The runtime baseline was main `f4f70bfa761556ce9460cbd7ade2c2dfabf9c38c`. The final detached composition was `14ca92351e0746d64fcdb268fad91b9cd2ad596c`; all seven executable refs above are proven Git ancestors of it. That composition ref is disposable evidence and was not pushed as an integration branch or presented for merge.

## Isolation and persistence

- PostgreSQL container: `modula-feature-reality-01-pg`.
- Required labels: `digital.modula.mission=GREENFIELD-FEATURE-REALITY-01` and `digital.modula.scope=qa-disposable`.
- Host exposure: loopback only, `127.0.0.1:55483`.
- Final acceptance database: `modula_feature_reality_01_integration3_20261102`.
- Final schema version: `087`.
- Production database, storage, signing keys, billing, packages, services and checkout were not used or changed.
- No package was published and no billing transaction was submitted.

## Migration and Atlas composition

The composed canonical mission migration order is:

1. `084_moliboo_signed_packs`
2. `085_greenfield_communities`
3. `086_greenfield_collections_and_drafts`
4. `087_greenfield_premium_apple_sandbox`

The combined migration test covers a production-shaped upgrade, a fresh 001→087 application, legacy QA reconciliation, down migration through each mission migration, and reapplication. Migration 084's up and down constraints both preserve the pre-existing web-runtime and GUBIC game-web package media types.

The disposable Atlas was generated from the combined runtime rather than copied from any individual PR:

| Measure | Result |
| --- | --- |
| Runtime method routes | 827 |
| Application routes | 584 |
| Framework-derived exclusions | 243 |
| Source-only routes | 0 |
| Runtime-only routes | 0 |
| Tables mapped | 367 |
| Atlas verification | 103/103 PASS |
| DOCX SHA-256 | `e3cd9c59457d2aafafdedf84d6919f00618393151e8901fdb438934fdb682f1c` |
| Cross-umask DOCX regeneration | Byte-identical; ZIP valid |

## Final test result

Command shape, with credentials deliberately omitted:

```text
MODULA_TEST_DATABASE_URL=<isolated-loopback-database> MODULA_TEST_ADMIN_DATABASE_URL=<isolated-admin-database> CI=true pnpm --dir services/greenfield-api exec vitest run tests/registry-trust.github-sync.test.ts tests/phase7e.vault-notes-platform.test.ts tests/communities.integration.test.ts tests/premium.apple-sandbox.integration.test.ts tests/api-fix-01.migration.test.ts tests/premium.apple-verifier.test.ts tests/moliboo-signed-packs.integration.test.ts tests/messaging.integration.test.ts tests/premium.integration.test.ts tests/story-dm-replies.integration.test.ts tests/collections-drafts.integration.test.ts tests/sticker-packs.integration.test.ts tests/package-closure-resolver.test.ts tests/greenfield-backend-v1.migration-ledger-security.test.ts --silent --reporter=json --maxWorkers=1 --no-file-parallelism
```

| Result | Count |
| --- | ---: |
| Test files | 14 |
| Suites | 31 |
| Suites passed | 31 |
| Tests | 89 |
| Tests passed | 89 |
| Tests failed | 0 |
| Tests skipped/pending | 0 |

Additional gates:

- `CI=true pnpm typecheck`: PASS for the full workspace.
- Combined candidate Atlas: 103/103 PASS.
- Combined Atlas DOCX regeneration under a different timezone/umask: byte-identical and valid.

## Journey evidence and remaining acceptance gates

| Journey | Persisted backend result | Remaining non-backend gate |
| --- | --- | --- |
| Moliboo | Signed content-only catalogue/download, hash/signature validation, ownership, outfit concurrency, withdrawal/restoration and sticker composer integration pass | Native PackageManager install, update, failed-update rollback and restart restoration were not executed on this VPS |
| Messaging | Concurrent create/retry produces one direct conversation and one optional initial message; blocks/privacy validation pass | Native share-sheet navigation was not executed |
| Story | Authorized reply creates/reuses the author DM, stores one normal message/context event and produces one idempotent notification | Native Story Reply UI must call the contract and open the returned conversation |
| Communities | Discover, join, post, vote, RSVP, settings, leave, private/banned access and stale writes pass | Native preview/local surfaces must be switched to the documented server contracts |
| Saved and Drafts | Existing saves interoperate with named collections; cross-user isolation, two-device revision conflict, recoverable failure and exactly-once publish pass | Native local-store migration/reconciliation remains a client integration task |
| Vault Notes | Generic registry, install/enable/update, record persistence, uninstall retention/deletion and account isolation pass | The requested Vault 2.0.2 signed package lacks the required package representation and current Native runtime support; PR-06 remains BLOCKED for the real install-to-open acceptance |
| Premium | Server-authoritative tiers/entitlements, signed Apple fixture validation, account binding, idempotent restore, upgrade/downgrade, grace, expiry and refund/revocation pass | A real Apple sandbox purchase/restore and server notification lifecycle was not executed; PR-07 remains PARTIAL |
| Calls | No runtime routes or signalling were added | Design review and Andy approval are required before any implementation |

## Mission disposition

The composed backend is regression-clean, but the overall mission must not be called QA READY yet. The remaining gates are explicit:

1. Native consumption and device/simulator acceptance for Moliboo, messaging, story replies, Communities, Collections and Drafts.
2. A compatible signed Vault Notes release representation plus Native package runtime support.
3. Real Apple sandbox purchase, restoration and notification evidence with confirmed product identifiers and billing periods.
4. Andy review/approval for every merge; all PRs remain draft and unmerged.

Production deployment, public publication, real billing and live calling remain prohibited and were not performed.
