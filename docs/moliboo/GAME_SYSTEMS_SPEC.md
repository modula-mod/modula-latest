# Moliboo Game Systems — Spec v1 (MOLIBOO-GAME-SYSTEMS-01)

Owner request (Andy, 2026-11-01): new items, an Inventory, special skills, game-style buffs, a Studio **Outfits** category with full outfits (hat + hair + clothes + accessories in one set), and "more things to do".
Sources: Master Bible §04 (access and fairness), §05 (Wardrobe, 250-SKU target), §06.2 (Studio IA: *Outfits* = saved loadouts), §07.2 (Collection Book and achievements), §08.4–8.6 (Game bridge, economy fairness), §10.2 (logical entities); Family Bibles 002–006 (each character's *Ability* is the source of its signature skill).

## 0. Non-negotiables
* **Server-authoritative.** Ownership, equipped looks, buffs, cooldowns, quest progress and grants live in GreenField. Clients render what the server returns and never write ownership (Bible §8.4.5).
* **No invented ownership.** Free items can be used by everyone and get **no** inventory rows. A row exists only with grant evidence (`source` + `source_ref`: quest/achievement/collection claim, premium entitlement, admin grant, gift).
* **Cosmetic only, no pay-to-win.** Items, outfits, skills and buffs never change competitive outcomes. The only numeric effect is a **friendship-XP comfort bonus, capped at 25% in total**. Premium items carry no extra effects, and premium accounts get no extra quests or XP.
* **Premium sits behind `premiumEnabled`** (`MODULA_PREMIUM_ENTITLEMENTS_ENABLED`). While it is off, premium items and sets are left out of the catalogue and cannot be equipped. While it is on, equipping a premium item needs an inventory row with `source = premium_entitlement`, granted by the entitlements system and never by these routes.
* **Fully offline-capable animation.** Rendering never needs a network call or AI model (Bible §09).

## 1. Items catalogue
| Field | Notes |
|---|---|
| `itemId` | `moliboo.item.<snake>`. Stable and never reused |
| `slot` | `headwear, hair, face, top, outerwear, bottom, footwear, back, handheld, aura` (the Bible §05 categories). One item per slot at a time |
| `rarity` | `common, uncommon, rare, epic, legendary`. Visual flair only: frame colour and shine |
| `access` | `free, earnable, premium` (Bible §4.3 access states map to inventory `status`: `free, owned, earnable_locked, premium_locked`) |
| `family`, `setId`, `iconKey`, `palette` | Family theming and set membership. `iconKey` matches `Moliboo/Items/<iconKey>.png` in native |

Seed v1 (`docs/moliboo/game-catalogue.v1.json`, also in migration 080): **88 items** (36 free, 27 earnable, 25 premium) and **15 full outfits**, 3 per family (Angels, Underground, Enchanted, Stardust, Dreamers). Each family has one free, one earnable and one premium outfit. This catalogue is separate from the 194 production Wardrobe SKUs. Bible §05 asks for reconciliation before freezing, so no existing SKU is renamed.

## 2. Inventory
`GET /v1/moliboo/inventory` returns every visible item with its `status`, its `source` (`free_access` for free items) and, for locked earnables, the `unlockQuestId`. Locked items appear as previews, never as purchase prompts. Revocation uses `revoked_at` and never deletes anything, so prior grants survive migrations (Bible §4.3).

## 3. Outfits (new Studio category)
* **Curated full outfits (sets)**: `GET /v1/moliboo/catalogue/outfits`. Each set lists its 4–6 slot items, a `completion` count (`owned/total`, a goal-gradient bar) and a **set bonus**: a cosmetic `while_equipped` aura FX, active only while every piece is worn.
* **Own outfits (saved loadouts)**: `GET/POST /v1/moliboo/outfits`, `PATCH/DELETE /v1/moliboo/outfits/:id`. Up to 24 per account (the Bible minimum is 3). `revision` gives optimistic concurrency, so a stale edit gets a `409` (Bible §6.2 "sync conflict handling").
* **Equip**: `POST /v1/moliboo/characters/:characterId/equip` with `{setId}`, `{outfitId}` or `{itemIds}`. Equipping a set with missing pieces returns `409 {detail.lockedItemIds}`, so the UI can show "3 of 5, unlock the rest via …".
* **Rig interface (`OutfitSet`)**: the character state includes `outfitSet = {characterId, slots: [{slot, itemId|null}]}` in canonical slot order (back → aura draw order, documented in native `MolibooOutfitSet.swift`). The rig stream renders from this list. No game-system code touches the rig.

## 4. Signature skills
One per character (75 from Family Bibles 002–006), taken from each bible's **Ability**. Examples: Aura, *Guiding Glow*; Bramble, *Bramble Bridge*; Somna, *Dream Atlas*. The 25 Originals get skills once their bible abilities are signed off.
`POST /v1/moliboo/characters/:id/skills/:skillId/use {idempotencyKey}` plays the **signature animation** (Bible §6.3), grants a family *Signature Glow* buff (45 min) and +10 friendship XP. Each skill has a 4 h cooldown, enforced on the server with `409 {availableAt}`. Skills are expressive and do not change difficulty in any game. For later games, the GameBridge may map a skill to a *balanced* shared move (Bible §8.6).

## 5. Buffs (timed effects)
| Source | Buff | Duration | Stack rule |
|---|---|---|---|
| care: feed | Well Fed (+10% friendship XP, cheek glow) | 3 h | refresh |
| care: play | Playful (+5%/stack, bounce sparkle) | 2 h | stack ×3 |
| care: rest | Well Rested (+10%, calm idle) | 6 h | refresh, group `mood` |
| care: groom | Freshly Groomed (shine FX) | 4 h | refresh |
| care: talk | Chatty (+5%/stack) | 2 h | stack ×2, group `mood` |
| skill | <Family> Signature Glow | 45 min | refresh, group `signature` |
| full set worn | <Set> set glow | while equipped | derived, never stored |

How stacking works: `refresh` resets the duration. `stack` adds a stack up to `maxStacks` and resets the duration. Applying a buff from an `exclusiveGroup` removes the other buffs in that group. The total friendship bonus is capped at 25%. Expired buffs simply lapse. Nothing negative happens when a buff ends: no sadness debuffs and no decay (Bible §6.3 "no frightening guilt animations").
Anti-spam: a care action counts (buff, XP, quests) at most once per 15 min per character and action. Extra taps still animate on the client and come back `counted:false`.

## 6. More things to do
1. **Daily care quests** (Care trio, Show-off, Dress-up, Play time). Small, finishable in about 2 minutes. They reset at 00:00 UTC, and missing a day costs nothing.
2. **Weekly caretaker** (15 care actions, no streak). Reward: a **disclosed surprise**. The whole pool is shown in the UI, and the pick is deterministic per account and week, never a duplicate. That gives a variable reward with no odds hidden, no purchase and no loss.
3. **Achievements** (Bible §7.2): First Outfit, Stylist, Skill Explorer, Devoted Friend, Mini-game Fan. Rewards are fixed and listed up front.
4. **Collections / set bonuses.** Every earnable set piece has its own unlock quest (e.g. 8 care actions with a Stardust Moliboo). The set completion bar uses goal-gradient. Completing a set unlocks the set glow.
5. **Mini-activities**: Bubble Pop, Star Catch, Memory Match. Short and client-side, with Reduce Motion and non-timed alternatives. The server only records completion: no score-based rewards, and at most 10 count per day.
6. **Friendship levels** per Moliboo, on a gentle curve (100, 150, 200 … XP). They never decay.
7. **Gifting / trading: phase 2, not built.** Bible §7.2 says collectible trading is not part of launch. Gifting will be a free, rate-limited one-way grant of *earnable duplicates* through `source = gift`, once moderation and child-safety review are done. The schema already accepts `gift`.

## 7. Psychology principles (used ethically)
| Principle | Where | Guardrail |
|---|---|---|
| Variable reward | Weekly surprise | Pool disclosed, deterministic, free, never a duplicate. No loot boxes and no paid rolls |
| Goal-gradient | Set completion bars, quest progress rings | Targets are small and always reachable with free play |
| Endowed progress | Every account starts with 36 free items and 5 free full outfits, and a free set gives its set glow at once | No fake "already 2/10" counters. All progress is real server data |
| Competence / autonomy | Signature skills, own outfits | No forced daily streaks and no FOMO timers. Seasonal items never revoke what's owned |
| Relatedness | Friendship levels, care | No guilt or sadness mechanics and no notification nagging |
| Fairness | Cosmetic only, 25% cap on a non-competitive stat | Premium is cosmetic, behind a flag and entitlement-only |
Dark patterns excluded: hidden odds, countdown pressure, streak loss, confirm-shaming, paid energy, friend-invite gates and pay-to-skip.

## 8. API summary (envelope `{data}` / `{error}`; auth required)
| Method | Path | Capability |
|---|---|---|
| GET | `/v1/moliboo/catalogue/items?slot=&family=` | social:read |
| GET | `/v1/moliboo/catalogue/outfits` | social:read |
| GET | `/v1/moliboo/inventory` | social:read |
| GET/POST | `/v1/moliboo/outfits` | read / profile:update |
| PATCH/DELETE | `/v1/moliboo/outfits/:outfitId` | profile:update |
| GET | `/v1/moliboo/characters/:characterId/state` | social:read |
| POST | `/v1/moliboo/characters/:characterId/equip` | profile:update |
| POST | `/v1/moliboo/characters/:characterId/care` `{action, idempotencyKey}` | profile:update |
| POST | `/v1/moliboo/characters/:characterId/skills/:skillId/use` `{idempotencyKey}` | profile:update |
| POST | `/v1/moliboo/activities/complete` `{activityId, characterId?, idempotencyKey}` | profile:update |
| GET | `/v1/moliboo/quests` | social:read |
| POST | `/v1/moliboo/quests/:questId/claim` `{characterId?}` | profile:update |

Character ids look like `moliboo.<family>.<name>` (e.g. `moliboo.angels.aura`). Character *ownership/unlock* is still owned by the existing Moliboo access system. These routes do not grant characters.

## 9. Data model (migration `080_moliboo_game_systems`)
Catalogue tables: `greenfield_moliboo_items, _outfit_sets, _buff_definitions, _skills, _quests`.
Per-account tables: `_inventory, _user_outfits, _equipped, _active_buffs, _events` (append-only, unique idempotency key), `_quest_progress` (period keys `d:YYYY-MM-DD`, `w:YYYY-Www`, `all`), `_friendship`.

## 10. Open items / integration
* Premium grants: the entitlements service has to insert `premium_entitlement` rows. That isn't in this PR.
* Wardrobe SKU reconciliation with the 194 production SKUs (Bible §05).
* Asset hosting: the icons are currently bundled in native. Later they move to CDN with versioned asset hashes (Bible §6.4).
* Rig: render `outfitSet.slots` in draw order. Set-bonus and buff FX keys (`effects.fx`) map to the asset-kit FX rewards.
