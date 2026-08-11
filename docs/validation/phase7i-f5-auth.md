# Phase 7I-F5 Authentication Foundation Validation

Date: 2026-08-11
Repo: `/root/modula-latest`
Branch: `phase7i-trusted-production-alpha`
Scope: source-level auth domain foundation only.

## Verdict

`SOURCE_FOUNDATION_PASS_WITH_PRODUCT_BLOCKERS`

This slice implements the authentication-method registry, challenge engine, security events, session recent-auth context, and password-login integration. It does not complete passkeys, email OTP product login, TOTP, recovery codes, Apple login, production DB application, or public acceptance.

## Files Implemented

| Path | Purpose |
| --- | --- |
| `services/greenfield-api/migrations/031_phase7i_f5_auth_domain.sql` | auth-domain tables and backfills |
| `services/greenfield-api/migrations/031_phase7i_f5_auth_domain.down.sql` | rollback for migration 031 |
| `services/greenfield-api/src/auth/` | auth domain services |
| `services/greenfield-api/src/sessions/service.ts` | recent-auth session context |
| `services/greenfield-api/src/authentication/service.ts` | password login through registry/security events |
| `services/greenfield-api/src/accounts/service.ts` | registration/verification/password-change method registry hooks |
| `services/greenfield-api/src/accounts/recovery.ts` | password-reset method registry/security event hooks |
| `services/greenfield-api/tests/greenfield.accounts.test.ts` | auth-domain assertions |
| `scripts/verify-phase7i-f5-auth-foundation.mjs` | honest F5 verifier status script |

## Commands Run

```sh
CI=true pnpm --filter @modula/api-contracts build
CI=true pnpm --filter @modula/greenfield-api typecheck
CI=true pnpm --filter @modula/greenfield-api build
CI=true pnpm --filter @modula/greenfield-api exec vitest run tests/greenfield.accounts.test.ts
```

Results:

| Command | Result |
| --- | --- |
| `CI=true pnpm --filter @modula/api-contracts build` | `PASS` |
| `CI=true pnpm --filter @modula/greenfield-api typecheck` | `PASS` |
| `CI=true pnpm --filter @modula/greenfield-api build` | `PASS` |
| `CI=true pnpm --filter @modula/greenfield-api exec vitest run tests/greenfield.accounts.test.ts` without DB env | `PASS`; DB integration skipped |

Additional final gates after docs/verifiers:

| Command | Result |
| --- | --- |
| `CI=true pnpm lint` | `PASS` |
| `CI=true pnpm typecheck` | `PASS` |
| `CI=true pnpm --filter @modula/greenfield-api test` without DB env | `PASS`; `15` files passed, `8` skipped; `38` tests passed, `86` skipped |
| `git diff --check` | `PASS` |
| `CI=true pnpm verify:phase7i-canonical-source` | `PASS`; `1648` files scanned |
| `CI=true pnpm verify:auth-password` | `PASS` |
| `CI=true pnpm verify:auth-email-otp` | `PASS` |
| `CI=true pnpm verify:auth-sessions` | `PASS` |
| `CI=true pnpm verify:auth-step-up` | `PASS` |
| `CI=true pnpm verify:phase7i-f5` | `BLOCKED`; `10` unmet checks for TOTP, passkeys, recovery, mail identity/provisioner, social, stories, marketplace, live web release, and mainline |

## Disposable DB Rehearsal

Disposable container:

| Field | Value |
| --- | --- |
| Container | `modula-phase7if5-auth-pg` |
| Image | `postgres:16.9-alpine` |
| Bind | `127.0.0.1:55435 -> 5432` |
| Database | `modula_f5_auth` |
| Production data | none |

Roles created for migration grants:

```text
modula_api
modula_worker
modula_backup
```

Commands:

```sh
MODULA_TEST_DATABASE_URL=postgres://postgres:[redacted]@127.0.0.1:55435/modula_f5_auth MODULA_DATABASE_URL=postgres://postgres:[redacted]@127.0.0.1:55435/modula_f5_auth MODULA_DATABASE_MIGRATOR_URL=postgres://postgres:[redacted]@127.0.0.1:55435/modula_f5_auth CI=true pnpm --filter @modula/greenfield-api exec vitest run tests/greenfield.accounts.test.ts
MODULA_PUBLIC_API_URL=http://127.0.0.1:4022 MODULA_ALLOWED_ORIGINS=http://localhost:8081 MODULA_DATABASE_URL=postgres://postgres:[redacted]@127.0.0.1:55435/modula_f5_auth MODULA_DATABASE_MIGRATOR_URL=postgres://postgres:[redacted]@127.0.0.1:55435/modula_f5_auth CI=true pnpm --filter @modula/greenfield-api db:status
MODULA_PUBLIC_API_URL=http://127.0.0.1:4022 MODULA_ALLOWED_ORIGINS=http://localhost:8081 MODULA_DATABASE_URL=postgres://postgres:[redacted]@127.0.0.1:55435/modula_f5_auth MODULA_DATABASE_MIGRATOR_URL=postgres://postgres:[redacted]@127.0.0.1:55435/modula_f5_auth CI=true pnpm --filter @modula/greenfield-api db:rollback
MODULA_PUBLIC_API_URL=http://127.0.0.1:4022 MODULA_ALLOWED_ORIGINS=http://localhost:8081 MODULA_DATABASE_URL=postgres://postgres:[redacted]@127.0.0.1:55435/modula_f5_auth MODULA_DATABASE_MIGRATOR_URL=postgres://postgres:[redacted]@127.0.0.1:55435/modula_f5_auth CI=true pnpm --filter @modula/greenfield-api db:migrate
```

Results:

| Check | Result |
| --- | --- |
| DB-backed `greenfield.accounts.test.ts` before rollback | `PASS`; `10` tests passed |
| Migration status after first apply | `pending: []`; latest applied `031_phase7i_f5_auth_domain` |
| Rollback | `rolledBack: 031_phase7i_f5_auth_domain` |
| Reapply | `applied: 031_phase7i_f5_auth_domain` |
| Migration status after reapply | `pending: []` |
| DB-backed `greenfield.accounts.test.ts` after reapply | `PASS`; `10` tests passed |

Full API test with `MODULA_TEST_DATABASE_URL` on this disposable DB remains `BLOCKED_BY_EXISTING_DYNAMIC_TEST_FAILURES`, not auth-foundation failure:

| Suite | Observed failure |
| --- | --- |
| `tests/phase6.security.test.ts` | search response shape mismatch in block/mute search assertion |
| `tests/phase7e.search-platform.test.ts` | search projection expectations not satisfied |
| `tests/phase7b.module-runtime.test.ts` | `invalid input syntax for type json` in module record collection seeding |
| `tests/phase7e.vault-notes-platform.test.ts` | search expectation not satisfied |

The focused auth DB test passed before and after migration rollback/reapply. The broader dynamic DB failures must remain classified separately before any final Phase 7I-F5 or Runtime 2 acceptance claim.

## Explicit Product Blockers

Still `BLOCKED`:

- passkey/WebAuthn registration and assertion;
- email OTP public sign-in route and async mail-code delivery;
- TOTP enrollment and verification;
- recovery-code generation/use;
- Sign in with Apple;
- account deletion;
- production DB migration application;
- public API/web/native acceptance.
