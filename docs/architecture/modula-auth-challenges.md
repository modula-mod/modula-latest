# Modula Authentication Challenges

Date: 2026-08-11

## Challenge Model

Migration `031_phase7i_f5_auth_domain` introduces `greenfield_auth_challenges` and `greenfield_auth_challenge_attempts`.

Challenge purposes:

```text
email_verification
email_login
password_reset
email_change
passkey_registration
passkey_authentication
totp_enrollment
step_up
account_recovery
```

Each challenge is:

- random;
- purpose-bound;
- account-bound where applicable;
- subject-bound where account is not yet known;
- short-lived;
- single-use;
- attempt-limited;
- replay-classified;
- audited through challenge-attempt rows.

## Storage

The service stores:

| Field | Purpose |
| --- | --- |
| `challenge_hash` | digest of the opaque challenge |
| `verifier_hash` | digest of the human-entered verifier/code |
| `attempt_limit` / `attempt_count` | brute-force limiter per challenge |
| `rate_limit_key` | coarse per-account/email/IP limiter key |
| `state` | `pending`, `consumed`, `expired`, `superseded`, or `locked` |

Plaintext OTP codes are returned by `ChallengeService.create()` exactly once for delivery by a caller such as an async mail-job flow. They are not stored in plaintext.

## Current Wiring

Implemented:

- challenge creation;
- pending challenge superseding;
- numeric verifier generation;
- invalid-attempt counting;
- lockout when the attempt limit is reached;
- success consumes the challenge;
- replay returns `CHALLENGE_REPLAYED`.

Not wired yet:

- public email OTP login API;
- async OTP mail job creation;
- passkey WebAuthn challenge verification;
- TOTP enrollment challenge route;
- recovery challenge route.
