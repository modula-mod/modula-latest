# Phase 7I-F3 Email And Association Evidence

Date: 2026-08-11

Scope: transactional-mail source changes, public DNS checks, public association-file checks, and current blockers. This document does not contain verification links, reset links, token values, SMTP credentials, mailbox passwords, or DKIM private key material.

## Transactional Email V2 Source Changes

Implemented in this pass:

- reusable renderer components in `services/greenfield-api/src/mail/components.ts`;
- branded multipart renderer in `services/greenfield-api/src/mail/templates.ts`;
- verification/password-reset links now use token-only `?t=` URLs from `services/greenfield-api/src/mail/service.ts`;
- HTML mail no longer displays `Plain URL:` or the full opaque token as visible copy;
- text mail keeps the action URL for accessibility and plain-text clients;
- hidden preheader text, semantic headings, CTA, metadata box, security notice, footer support/security/privacy links, and dark-mode metadata are present;
- frontend auth routes accept both `?t=` and old `?token=` links for compatibility.

Security-alert template IDs now exist for:

- `new-sign-in`;
- `password-changed`;
- `email-changed`;
- `passkey-added`;
- `passkey-removed`;
- `recovery-used`;
- `sessions-revoked`;
- `mail-forwarding-changed`.

Verification commands:

```sh
CI=true pnpm --filter @modula/greenfield-api exec vitest run tests/mail.templates.test.ts
CI=true pnpm --filter @modula/greenfield-api typecheck
CI=true pnpm --filter @modula/greenfield-api build
CI=true pnpm typecheck
CI=true pnpm lint
git diff --check
```

Results:

| Command | Result |
| --- | --- |
| `CI=true pnpm --filter @modula/greenfield-api exec vitest run tests/mail.templates.test.ts` | `1 passed`, `3 tests passed` |
| `CI=true pnpm --filter @modula/greenfield-api typecheck` | passed |
| `CI=true pnpm --filter @modula/greenfield-api build` | passed |
| `CI=true pnpm typecheck` | passed |
| `CI=true pnpm lint` | passed |
| `git diff --check` | passed |

## Public Mail DNS Snapshot

Commands:

```sh
dig +short TXT modula.digital
dig +short TXT _dmarc.modula.digital
dig +short MX modula.digital
dig +short A mail.modula.digital
dig +short TXT mail._domainkey.modula.digital
```

Observed:

| Record | Result |
| --- | --- |
| `modula.digital TXT` | `modula-verification=active`; `v=spf1 mx ip4:87.106.40.136 -all` |
| `_dmarc.modula.digital TXT` | `v=DMARC1; p=none; adkim=r; aspf=r` |
| `modula.digital MX` | `10 mail.modula.digital.` |
| `mail.modula.digital A` | `87.106.40.136` |
| `mail._domainkey.modula.digital TXT` | DKIM public key present for selector `mail` |

Interpretation: public mail DNS is no longer in the earlier duplicate-SPF/duplicate-DMARC/no-DKIM state. However Gmail authentication cannot be marked PASS from DNS alone; the Gmail original headers are still required to prove SPF, DKIM, DMARC, and TLS for the received message.

## Public Associated-Domain Snapshot

Commands:

```sh
curl -I -fsS --max-time 10 https://modula.digital/.well-known/apple-app-site-association
curl -I -fsS --max-time 10 https://modula.digital/.well-known/assetlinks.json
```

Observed:

| Path | HTTP | Content type | Interpretation |
| --- | --- | --- | --- |
| `/.well-known/apple-app-site-association` | `200` | `text/html; charset=utf-8` | serves web app HTML, not AASA JSON |
| `/.well-known/assetlinks.json` | `200` | `text/html; charset=utf-8` | serves web app HTML, not Digital Asset Links JSON |

Interpretation: iOS and Android native passkey association is not ready. The server must serve valid AASA and Asset Links JSON with the actual app identifiers before native passkeys can pass.

## Email Verdict

`BLOCKED` for production-ready mail/passkey association.

Reasons:

- Gmail original headers were not available in this environment, so SPF/DKIM/DMARC/TLS receipt cannot be verified;
- public association files are missing/misrouted;
- Modula Mail identity data model/provisioner state does not exist yet;
- Hestia mailbox quotas are currently unlimited;
- passkey backend and native client flows are not implemented in this pass.
