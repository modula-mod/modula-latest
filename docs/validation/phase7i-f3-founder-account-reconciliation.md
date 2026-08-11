# Phase 7I-F3 Founder Account Reconciliation

Date: 2026-08-11

Scope: sanitized inspection of the private Greenfield production database and Hestia mailbox state from the VPS. No password hashes, session tokens, verification tokens, reset tokens, SMTP credentials, database credentials, or DKIM private key material were printed or recorded.

## Existing Founder-Looking Account

Commands used safe column selection from `modula-production-greenfield-postgres-1`.

| Field | Value |
| --- | --- |
| Account ID | `019feda2-9968-700b-a23d-e4981023eda0` |
| Account state | `active` |
| Primary handle | `modula_org` |
| Contact email | `msjoy.andre@gmail.com` |
| Contact email state | `verified` |
| Contact email verified at | `2026-08-10 21:45:53.86+00` |
| Account created at | `2026-08-10 21:44:44.136+00` |
| Account updated at | `2026-08-10 21:45:53.86+00` |
| Actor ID | `actor-019feda2-9968-700b-a23d-e4981023eda0` |
| Profile ID | `profile-019feda2-9968-700b-a23d-e4981023eda0` |
| Profile handle | `modula_org` |
| Profile display name | `Modula` |
| Password credential | `present` |
| Password credential params | `{"algorithm": "argon2id"}` |
| Passkey count | `0` |
| Active session count | `8` |
| Last session seen at | `2026-08-10 23:14:51.217+00` |
| Running API `MODULA_ADMIN_HANDLES` | empty |

Interpretation: a real active account exists for the expected recovery/contact email and profile handle seen in prior evidence. Founder/admin capability is not proven because no admin handles are configured in the running API environment.

## Verification Token Exposure Check

Known founder account verification rows:

| Verification ID | State | Created at | Expires at | Consumed at |
| --- | --- | --- | --- | --- |
| `019feda2-9985-7cd4-b863-6445bf8b2793` | `ALREADY_CONSUMED` | `2026-08-10 21:44:44.136+00` | `2026-08-11 21:44:44.136+00` | `2026-08-10 21:45:53.86+00` |

Active unconsumed verification rows for this account: `0`.

Interpretation: the screenshot-exposed verification credential is treated as potentially exposed, but the reconciled account's verification token row is already consumed. No replacement token was issued because the account is already verified and there are no active verification rows to invalidate.

## Mail Job Evidence For Account

| Template | Status | Count | Latest created at | Latest sent at |
| --- | --- | --- | --- | --- |
| `verification` | `sent` | `1` | `2026-08-10 21:44:44.166+00` | `2026-08-10 21:44:49.237+00` |
| `new-sign-in` | `sent` | `8` | `2026-08-10 23:11:39.423+00` | `2026-08-10 23:11:42.355+00` |

## Hestia Mailbox Reconciliation

Command:

```sh
v-list-mail-accounts andrei modula.digital json
```

Sanitized result:

| Address | Hestia state | Quota | Date | Greenfield owner |
| --- | --- | --- | --- | --- |
| `andrei@modula.digital` | existing manual mailbox | `unlimited` | `2025-11-02` | none found |
| `support@modula.digital` | existing manual mailbox | `unlimited` | `2025-11-03` | none found |
| `admin@modula.digital` | existing manual mailbox | `unlimited` | `2025-11-03` | none found |
| `modula_org@modula.digital` | absent in Hestia listing | n/a | n/a | account handle exists in Greenfield |

Interpretation:

- `andrei@modula.digital` already exists in Hestia, but no Greenfield account or auth identity exists for `andrei` or `andrei@modula.digital`.
- The requested future founder address `andrei@modula.digital` is therefore `MANUAL_EXISTING`, not safe to auto-create.
- The current Greenfield founder-looking account's handle-mailbox candidate `modula_org@modula.digital` is `ABSENT` in Hestia.

## Classification

Account classification: `PERMANENT_FOUNDER_CANDIDATE`.

Blocking gaps before it can be finalized as permanent founder:

- no passkey is registered;
- no recovery codes are implemented/proven;
- no Modula Mail identity table exists yet;
- founder/admin role is not configured/proven;
- requested `andrei@modula.digital` mailbox collides with an existing manual Hestia mailbox;
- current mailbox quotas are unlimited and do not satisfy the bounded quota requirement.

No new founder account was created in this pass.
