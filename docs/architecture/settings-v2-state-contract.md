# Settings V2 state contract

Settings V2 adds account-scoped application preferences and read models without replacing the existing settings domains. Each store has a single, non-overlapping authority.

## Authoritative stores

| Store | Authority | Settings V2 relationship |
|---|---|---|
| `greenfield_account_app_preferences` | Feed defaults, email-digest enablement and schedule zone, time display, and measurement units | Settings V2 is the only writer. `GET/PATCH /v1/accounts/me/app-preferences` resolves defaults and persists the fixed allow-list. |
| `notification_preferences` | Activity categories/channels, bundle style, module notification policy, and quiet hours | Not replaced or copied. The digest worker reads `quiet_hours` only as a delivery hold. `bundle_style = digest` does not enable email digests. |
| `greenfield_appearance_preferences` | Theme, surface, accent, typography, motion, transparency, and contrast | Independent. Settings V2 never reads or writes it. |
| `atproto_publication_preferences` | AT Protocol publication behavior | Independent. Settings V2 never reads or writes it. |
| `greenfield_module_installation_settings` | Per-installation module settings and secrets references | Independent and governed by module installation ownership. |

There is no dual write or background synchronization between these stores. A client must use the endpoint owned by the setting it is changing.

## Digest precedence

Email digest delivery requires all of the following:

1. `digests.weekly` or `digests.morning` is enabled in `greenfield_account_app_preferences`;
2. the period is due in `digests.timeZone`;
3. `notification_preferences.quiet_hours` does not currently hold delivery;
4. the account is active and has a verified email identity;
5. the digest contains activity.

Quiet hours take precedence over a due digest while their window is active. They do not mutate the application preference. A unique `(account_id, digest_kind, period_key)` delivery row prevents duplicate composition.

## API ownership and contracts

All nine Settings V2 routes require a Greenfield bearer session. The account identifier comes only from the resolved session; no route accepts an account ID in its path, query, or body.

| Route | Behavior | Primary tables |
|---|---|---|
| `GET /v1/accounts/me/app-preferences` | Resolved preference defaults, version, update time, and sanitized digest status | `greenfield_account_app_preferences`, `greenfield_auth_identities`, `greenfield_digest_deliveries` |
| `PATCH /v1/accounts/me/app-preferences` | Strict partial update of the fixed key allow-list | `greenfield_account_app_preferences` |
| `GET /v1/accounts/me/mutes` | Current account's active mute targets | `actors`, `profiles`, `mutes` |
| `GET /v1/accounts/me/blocks` | Current account's active block targets | `actors`, `profiles`, `blocks` |
| `GET /v1/creator/insights` | Seven-, 28-, or 90-day engagement series for the current account | social post, reaction, comment, follow, save, share, and story tables |
| `GET /v1/creator/payouts` | Current account's append-only creator ledger; provider remains disabled | `greenfield_creator_ledger_entries` |
| `GET /v1/commerce/invoices` | Current account's invoices | `greenfield_commerce_invoices` |
| `POST /v1/auth/step-up/password` | Re-authenticates only the current session and account | password credential, authentication method, and session tables |
| `GET /v1/account/deletion-requests/current` | Current account's active deletion request | `greenfield_account_data_requests` |

The preference patch accepts either a direct object of allowed keys or `{ "preferences": { ... } }`. Unknown keys, extra wrapper fields, invalid enum values, invalid time zones, wrong types, empty updates, and requests above the global body limit are rejected. Password step-up accepts exactly one `password` field.

## Client state

At API-BASELINE-02, no repository client calls the new application-preference endpoints. Existing notification and appearance screens continue to use their established APIs. Settings V2 therefore introduces no client dual write, but its feed/time/unit preferences remain backend capability until a client explicitly adopts this contract.
