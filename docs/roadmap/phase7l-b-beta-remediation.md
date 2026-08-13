# Phase 7L-B Beta Remediation Roadmap

Date: 2026-08-13
Input: Phase 7L-A audit artifacts under `docs/validation/phase7l-a-*`.

## Order of repair

| Order | Severity | Domain | Repair target | Source artifact |
| --- | --- | --- | --- | --- |
| 1 | P0 | Auth/session | Make web reload and cold browser restore truthful: persist securely or explicitly gate web persistence as unsupported | `phase7l-a-auth-journey.md` |
| 2 | P0 | Auth/UI E2E | Run and pass controlled browser password and OTP login from submit to authenticated Home, `/v1/accounts/me`, reload restore, logout | `phase7l-a-auth-journey.md` |
| 3 | P0 | Native | Run Mac `xcodebuild` and simulator audit; record `BUILD SUCCEEDED` or concrete failure | `phase7l-a-native-audit.md` |
| 4 | P1 | Web runtime | Fix React hydration/runtime error `#418` across public routes | `phase7l-a-browser-runtime.md` |
| 5 | P1 | Media/API | Fix API media cross-origin response policy so `modula.digital` can render `api.modula.digital/v1/media/...` | `phase7l-a-media-rendering.md` |
| 6 | P1 | Product Hub | Hide/merge duplicate stale module IDs; one user-facing product per canonical `moduleId` | `phase7l-a-product-hub-vault-notes.md` |
| 7 | P1 | Vault Notes | Prove create/edit/delete/folder/tags/search/archive/restore/settings lifecycle using schema-correct payloads | `phase7l-a-product-hub-vault-notes.md` |
| 8 | P1 | Product Hub | Classify planned products as `COMING_SOON`, quarantined generated modules as `INTERNAL_ONLY`, and remove red unavailable messaging for intentional future products | `phase7l-a-product-hub-vault-notes.md` |
| 9 | P1 | Social UI | Browser-prove posts, reactions, comments, follows, bookmarks, reposts, moderation, Stories, and notifications with two accounts | `phase7l-a-feature-matrix.md` |
| 10 | P1 | Module runtime | Rerun Standard 2 and Vault Notes lifecycle verifiers with an approved disposable DB URL; keep live-deployment failures separate from source failures | `phase7l-a-module-runtime-health.md` |
| 11 | P1 | Security | Browser-prove Security Center entries or hide/gate passkeys/TOTP/recovery flows until ready | `phase7l-a-feature-matrix.md` |
| 12 | P2 | Structural UI | Reduce noisy logged-out 401 console errors on protected-route redirects | `phase7l-a-browser-runtime.md` |
| 13 | P2 | Structural UI | Fix web `useNativeDriver` warnings and motion adapter behavior | `phase7l-a-browser-runtime.md` |
| 14 | P2 | Associated domains | Verify/fix AASA MIME and Apple acceptance | `phase7l-a-static-assets.md` |
| 15 | P2 | Accessibility | Run VoiceOver/Dynamic Type/focus/touch-target pass on auth, drawer, nav, stories, comments, settings, Product Hub | `phase7l-a-feature-matrix.md` |
| 16 | P3 | Polish | Auth and settings density/hierarchy cleanup after P0/P1 runtime issues are green | `phase7l-a-ui-defect-inventory.md` |

## Non-goals for Phase 7L-B

- No MDHS expansion.
- No new Product Hub subsystem.
- No visual redesign until P0/P1 functionality and rendering repairs are verified.
- No hidden "PASS" for native without Mac build output.
