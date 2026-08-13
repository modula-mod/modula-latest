# Phase 7L-A UI Defect Inventory

Date: 2026-08-13
Scope: inventory only, no redesign.

## P0/P1 UI-blocking defects

| Defect | Status | Severity | Evidence | Repair domain |
| --- | --- | --- | --- | --- |
| Web session cannot survive reload/cold browser restore | BROKEN | P0 | `src/auth/storage/WebMemorySessionStorage.ts` | Auth/session |
| Authenticated browser login handoff not proven | INCOMPLETE | P0 | API session proof exists; browser crawl unauthenticated | Auth/UI E2E |
| React hydration/runtime error `#418` across production public routes | BROKEN | P1 | `docs/validation/evidence/phase7l-a/browser-public/runtime-events.json` | Web runtime |
| API-hosted media blocked by cross-origin response policy | BROKEN | P1 | `net::ERR_BLOCKED_BY_RESPONSE.NotSameOrigin`; media HEAD has `Cross-Origin-Resource-Policy: same-origin` | Media/API headers |
| Product Hub duplicates stale module identities | DUPLICATED | P1 | Registry contains canonical `digital.modula.vault-notes` and duplicate `modula.module.vaultNotes`; duplicate Tasks/DIMON rows also present | Product Hub/registry |
| Vault Notes lifecycle copy can imply unavailable while canonical backend is installable/enabled | MISLEADING | P1 | Canonical module published/installable; duplicate unavailable row exists | Product Hub/Vault Notes |

## P2 structural UI defects

| Defect | Status | Severity | Evidence | Repair domain |
| --- | --- | --- | --- | --- |
| Logged-out protected-route API 401s appear as console errors | WORKING_WITH_DEFECTS | P2 | Browser runtime crawl on Activity/Profile/Product Hub | Auth route guards |
| `useNativeDriver` warning on web | WORKING_WITH_DEFECTS | P2 | 3 browser warnings | Motion/web adapter |
| AASA MIME is `application/octet-stream` | WORKING_WITH_DEFECTS | P2 | Static asset curl | Associated domains |
| Auth sign-in lacks visible Apple/passkey affordance | INCOMPLETE | P2 | `src/auth/screens/SignInScreen.tsx` | Auth UI/security |
| Public Home has 68 visible press targets in mobile crawl | WORKING_WITH_DEFECTS | P2 | Browser route record | Navigation density |
| Public Discover has 252 visible press targets in mobile crawl | WORKING_WITH_DEFECTS | P2 | Browser route record | Discover density |

## P3 polish inventory

| Defect | Status | Severity | Evidence | Repair domain |
| --- | --- | --- | --- | --- |
| Public auth screens need final hierarchy/density review after runtime fixes | WORKING_WITH_DEFECTS | P3 | Screenshots captured | Auth visual design |
| Settings/Appearance controls render in public crawl but authenticated persistence visual proof is pending | INCOMPLETE | P3 | API appearance updates pass; browser settings crawl unauthenticated | Settings UI |

## Explicit non-redesign rule

Phase 7L-A does not redesign spacing, cards, typography, or module surfaces. These defects become Phase 7L-B repair inputs. The serious UI redesign starts only after P0/P1 repair verification.
