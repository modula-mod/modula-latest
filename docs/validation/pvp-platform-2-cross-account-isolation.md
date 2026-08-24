# PVP Platform Phase 2 cross-account isolation

Recorded: 2026-08-24

Environment: disposable PostgreSQL `modula_test` on `127.0.0.1:55438`

Production database: not used

## Result

`CROSS ACCOUNT LEAKS = 0` in the automated extension-fabric and immutable
reference-product suites.

## Proven boundaries

| Boundary | Account B result |
| --- | --- |
| Account A Module Host composition | `404 NOT_FOUND` |
| Account A target resource through capability broker | `404 NOT_FOUND` |
| Invoke extension action using Account A note | denied before assertion |
| Account A extension install graph | not returned |
| Account A grants | not returned |
| Account A extension jobs | not returned/created |
| Event for Account A delivered to Account B subscription | no job created |
| Account A namespaced extension metadata | account-scoped query only |

The broker resolves a resource with all of `account_id`, target product,
collection, and record ID. A foreign resource is deliberately indistinguishable
from a missing resource. Graph, installation, contribution, grant, assertion,
job, subscription, event, metadata, lifecycle, and developer-inspector queries
all carry the authenticated account.

## Test evidence

`services/greenfield-api/tests/pvp-platform-2.extension-fabric.test.ts` creates
separate accounts and proves capability/resource and event/job isolation while
also checking audit/job redaction and bounded service timeout retries. Result:
`9 passed`.

`services/greenfield-api/tests/pvp-platform-2.reference-products.test.ts`
registers and verifies two real Greenfield accounts, installs the four immutable
reference releases for Account A, then proves Account B cannot open Account A's
Vault Notes host. Result: `4 passed`.

Commands:

```text
CI=true pnpm verify:extension-cross-account-isolation
```

```text
CI=true pnpm verify:extension-security
```

Both require `MODULA_TEST_DATABASE_URL`; the verifier fails rather than silently
skipping when that disposable database input is absent.
