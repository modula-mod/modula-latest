# Phase 7E Block 14 Web Acceptance

Status: partial live acceptance; module install flow blocked by deployed
Greenfield registry state

Date: 2026-08-02
Frontend: `https://modula.digital`
API target used by production frontend: `https://api.modula.digital`
API reported environment: `preview`

## Browser and Route Acceptance

Playwright captured evidence under:

`docs/validation/evidence/phase7e-block14-web/`

Screenshots:

- `login-light-wide.png`
- `registration-dark-narrow.png`
- `home-oled-wide.png`
- `home-reduced-motion.png`
- `drawer-dark-wide.png`
- `composer-light-wide.png`
- `discover-dark-wide.png`
- `activity-light-wide.png`
- `profile-dark-narrow.png`
- `board-light-wide.png`
- `product-hub-dark-wide.png`
- `module-detail-light-wide.png`
- `standard2-reference-module-dark-wide.png`
- `vault-notes-dark-wide.png`
- `vault-notes-editor-light-wide.png`
- `vault-notes-settings-dark-wide.png`
- `ai-configuration-state-oled.png`
- `settings-light-wide.png`
- `settings-larger-text.png`
- `error-state-dark-wide.png`
- `manifest.json`

Coverage includes light, dark, OLED, narrow viewport, wide viewport, larger text
and reduced motion.

## Live API Acceptance

Synthetic handles:

- primary: `b14amsb2xub7n73r`
- secondary: `b14bmsb2xub7n73r`

No access token, refresh token or invite code is stored in this report.

Passed live checks:

| Flow item | Endpoint | Result |
| --- | --- | --- |
| register primary account | `POST /v1/accounts/register` | `201` |
| verify primary email | `POST /v1/accounts/verify-email` | `200` |
| login primary | `POST /v1/sessions` | `200` |
| register secondary account | `POST /v1/accounts/register` | `201` |
| verify secondary email | `POST /v1/accounts/verify-email` | `200` |
| login secondary | `POST /v1/sessions` | `200` |
| mint preview capability sessions for synthetic handles | `POST /v1/auth/preview/session` | `200` |
| restore session | `GET /v1/sessions/me` | `200` |
| load profile | `GET /v1/profiles/:handle` | `200` |
| edit profile | `PATCH /v1/profiles/me` | `200` |
| load appearance | `GET /v1/accounts/me/appearance` | `200` |
| edit appearance | `PATCH /v1/accounts/me/appearance` | `200` |
| create post | `POST /v1/posts` | `201` |
| edit post | `PATCH /v1/posts/:postId` | `200` |
| comment | `POST /v1/posts/:postId/comments` | `201` |
| like post | `POST /v1/posts/:postId/like` | `200` |
| react to post | `PUT /v1/posts/:postId/reaction` | `200` using `celebrate` |
| react to comment | `PUT /v1/comments/:commentId/reaction` | `200` using `celebrate` |
| follow second account | `POST /v1/profiles/:profileId/follow` | `200` |
| notifications | `GET /v1/notifications?limit=10` | `200` |
| search | `GET /v1/search?q=msb2xub7n73r&type=posts` | `200` |
| Product Hub registry | `GET /v1/registry/modules?limit=50` | `200` |

Provider state:

- `GET /v1/ai/providers` returned `404` on the deployed preview API.
- No deterministic AI provider was used.
- The frontend AI state captured for Block 14 is the configuration-required
  state, not a fabricated provider success.

## Module Acceptance Blocker

The live API registry is not at the Block 14 runtime release state.

Observed live registry:

- `GET /v1/registry/modules/digital.modula.standard2-reference` -> `404 NOT_FOUND`
- `POST /v1/modules/digital.modula.standard2-reference/install-preview` -> `404 NOT_FOUND`
- `GET /v1/registry/modules/modula.vault-notes` -> `404 NOT_FOUND`
- `POST /v1/modules/modula.vault-notes/install-preview` -> `404 NOT_FOUND`
- `GET /v1/registry/modules/digital.modula.vault-notes` -> `200`
- `POST /v1/modules/digital.modula.vault-notes/install-preview` for version `0.2.0` -> `200`
- `POST /v1/modules/digital.modula.vault-notes/install` for version `0.2.0` -> `202`

This proves that the currently deployed preview API still exposes the older
`digital.modula.vault-notes@0.2.0` registry entry and does not expose:

- Standard 2 reference module `digital.modula.standard2-reference@2.0.0`
- Vault Notes 1.1 module `modula.vault-notes@1.1.0`

Completing the live module install acceptance would require a Greenfield
registry/data update or Greenfield deployment. That was not performed because
production Greenfield deployment and production database migration were not
authorized for Block 14.

## Domain Acceptance

Passed:

- `https://modula.digital/` returns Modula app shell
- `https://www.modula.digital/` redirects to `https://modula.digital/`
- OpenWebUI signature is absent from the Modula HTML
- JavaScript assets load through the static Expo artifact
- SPA fallback works for module and settings routes
- `https://modula.digital/version.json` returns a non-secret Modula marker
- `https://api.modula.digital/v1/meta` is reachable

## Native Status

Phase 7F Mac/iOS acceptance has not been executed.
No native iOS acceptance result is claimed.
