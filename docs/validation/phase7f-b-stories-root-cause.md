# Phase 7F-B — Stories Root-Cause Audit

**Date:** 2026-08-05  
**Baseline:** Phase 7F-A commit `34ba1dc` / evidence `03-authenticated-home.png`  
**Severity:** Release-blocking for Phase 7F-B

## Exact cause

Stories disappear because Home mounts `PresenceStoriesRail` with the default empty `people = []`, and the rail returns `null` when empty. Phase 7E Block 11 intentionally removed the default seed (“no product mocks”), but **no real Stories query, repository, or Greenfield API was added** to replace it.

This is not a layout clip, z-index, opacity, Focus Mode (unless Deep Focus hides nav), or feature-flag flip for Stories specifically.

### Causal chain

```text
Home route (tabs/index)
→ HomeFeedScreen presence block (layout block ON by default)
→ <PresenceStoriesRail compact showCaption={false} />  // no people prop
→ people defaults to []
→ if (people.length === 0) return null
→ rail invisible
```

Parallel gaps:

1. No story query/hook
2. No Stories repository contract
3. No Greenfield `/v1/stories*` routes or tables
4. Orphaned seed `presenceRailSeed.ts` (zero imports) — must not be reattached as product data
5. “Add Story” / tap paths only navigate to `/product/presence` preview; no create/viewer persistence

## Affected files

| Layer | Path | Finding |
| --- | --- | --- |
| Route | `src/app/(tabs)/index/index.tsx` | Thin → HomeFeedScreen |
| Home | `src/features/feed/screens/HomeFeedScreen.tsx` | Mounts rail without data |
| Rail | `src/features/presence/components/PresenceStoriesRail.tsx` | Empty → `null` |
| Contract | `src/features/presence/contracts/presenceRail.ts` | UI person shape only |
| Seed | `src/features/presence/data/presenceRailSeed.ts` | Orphaned fixtures |
| Query/hook | — | Missing |
| Repository | — | Missing |
| API (app) | — | Missing |
| Greenfield | `services/greenfield-api` | No stories domain |
| History | `docs/validation/phase7e-block11-no-product-mocks-recovery.md` | Seed removed on purpose |

## Reproduction

1. Launch authenticated Home on Simulator (Phase 7F-A path).
2. Observe header + Focus/Merge banners + feed mode control + composer + posts.
3. Confirm no Stories rail between header/mode area and feed (see `03-authenticated-home.png`).
4. Grep confirms Home never passes `people` and no `/v1/stories` client exists.

## Expected behaviour

Authenticated Home shows a real Stories rail below the primary header / feed selector area:

- Add Story always visible when authenticated
- Followed accounts with active (non-expired) stories
- Suggested accounts only when real policy supports them
- No fake avatars when nobody has stories
- Ring states from real records (unviewed / partial / viewed / owner / uploading / failed)
- Create → upload → persist → rail refresh → viewer
- Expiry enforced server-side; expired absent from rail
- Owner delete / retry failed upload without fabricated viewer counts

## Repair plan

1. **Greenfield Stories domain** (non-production migrations only in the Phase 7F-B mutable env):
   - Tables for story groups/items, views, media refs, expiry, visibility
   - Routes: list rail, create, upload intent, get group, mark viewed, delete owner story
   - Server filters expired and visibility
2. **App repository + hook** under `src/data/repositories` + `src/features/presence` (or stories feature) — real API only; no seed import in product runtime.
3. **Home wiring:** query rail → map to `PresenceRailPerson` (or successor contract) → pass into rail; when empty authenticated, still show Add Story row (do not hide entire rail).
4. **Creation + viewer:** photo-library path on Simulator; real media upload service; viewer open/next/prev/pause/resume/viewed/delete.
5. **Tests + verifier:** prove real query path, no fixtures, expiry server-side.

## Tests

| Test | Asserts |
| --- | --- |
| Unit: rail empty authenticated | Add Story visible; no fake people |
| Unit: grouping | Multiple items → one account group |
| Unit: viewed state mapping | Partial / full from records |
| Integration: repository | Hits `/v1/stories*` ; empty ≠ seed |
| API: expiry | Expired excluded from rail response |
| API: visibility | Private/followers policy enforced |
| Verifier `verify-phase7f-b-stories.mjs` | End-to-end contract above |
| Verifier `verify-phase7f-b-no-native-product-mocks.mjs` | Seed not imported by Home |

## Classification vs Phase 7F-A

Phase 7F-A smoke did **not** list Stories as a defect (smoke scope was build/launch/shell). Visually, Stories were already absent in `03-authenticated-home.png`. Phase 7F-B treats that absence as a product blocker and repairs it with real domain data — **not** by restoring `PRESENCE_RAIL_SEED`.
