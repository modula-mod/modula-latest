# Phase 7M-B8 — Component reconstruction matrix (Gate B)

**Rule:** Every listed component has KEEP / REFINE / REWORK / REPLACE / REMOVE. **No UNKNOWN.**

| Component | Path / locus | Decision | Mockup IDs | Notes |
| --- | --- | --- | --- | --- |
| PostShell | `src/features/social/posts/components/post-shell.tsx` | REFINE | FM-POST-*, FM-VIDEO-001, FM-MUSIC-*, FM-POST-003 | Single grammar; align resting chrome + mode transitions |
| PostActionRail | `.../post-action-rail.tsx` | REFINE | FM-ACTION-RAIL-001, FM-POST-001/002/006 | Geometry, drag threshold, morph origin |
| ReactionPicker | `.../interactions/reaction-picker.tsx` | REFINE | FM-REACTION-001 | Backend-truth reactions only |
| CustomReactionPicker | `.../custom-reaction-picker.tsx` | REFINE | FM-REACTION-001 | No invented server reaction IDs |
| PostContextMenu | `.../post-context-menu.tsx` | REFINE | FM-CONTEXT-MENU-001 | Real overflow actions only |
| CommentsSurface | `.../comments-surface.tsx` | REFINE | FM-POST-001/003/006 | Real comments data; peek/partial/full |
| PostGestureController | `.../post-gesture-controller.tsx` | REFINE | FM-POST-004 | Enforce gesture contract |
| Interaction machine/types | `.../state/post-interaction-*` | KEEP | FM-POST-004 | Map RESTING→`idle`, etc. |
| Image renderer | `.../image-post-renderer.tsx` | REFINE | FM-POST-002/005 | Full-bleed resting |
| Video renderer | `.../video-post-renderer.tsx` | REFINE | FM-VIDEO-001 | Real controls only |
| Music renderer | `.../music-post-renderer.tsx` | REFINE | FM-MUSIC-* | Real playback only |
| Carousel renderer | `.../carousel-post-renderer.tsx` | REFINE | FM-POST-003 | Controlled media; page dots |
| Text/Link/Poll renderers | `.../*-post-renderer.tsx` | KEEP | FM-POST-004 | Wireframe coverage; light polish only |
| MediaFullPlayer | `.../media-full-player.tsx` | REFINE | FM-VIDEO-001, FM-MUSIC-* | Immersive player |
| Post tokens (layout/geometry/motion) | `.../tokens/*` | REFINE | all post FMs | Match mock density/spacing |
| ProductHubMarketplaceScreen | `src/features/modules/screens/ProductHubMarketplaceScreen.tsx` | REFINE | FM-HUB-001 | Editorial hub; no fake metrics |
| Module detail screen | marketplace/`[moduleId]` + detail comps | REFINE | FM-VAULT-001/002 | App-store composition; truthful registry |
| ProductStatsRow / metrics | `src/platform/ui/chrome/*` | KEEP | FM-VAULT-* | Must remain honest (no stars invention) |
| InstallPreviewSheet | modules Install sheet | REFINE | FM-VAULT-*, FM-HUB-001 | Reachable CTA |
| Module identity subtext | NEW primitive + hub/detail headers | NEW | FM-MODULE-ID-001 | `moduleId@version` under title |
| Welcome / Sign-in / OTP | `src/auth/screens/*` | REFINE | (auth ask) | Consumer copy; no architecture jargon |
| SecuritySettingsScreen | settings security | REFINE | FM-APPLOCK-001, FM-SECURITY-001 | Add Local App Lock section |
| AccountSessionsScreen | sessions | KEEP | FM-SECURITY-001 | Map “devices” carefully; not fake trust store |
| App Lock unlock screens | NEW `src/features/security/app-lock/*` | NEW | FM-APPLOCK-001..004 | Local SecureStore; optional biometric |
| Choose unlock method sheet | NEW | NEW | FM-APPLOCK-002 | PIN/Password/Pattern/Biometric |
| Step-up unlock modal | NEW | NEW | FM-APPLOCK-004 | Sensitive-action gate |
| Privacy Lock Mode | NEW (local) | NEW | FM-APPLOCK-004 | Local privacy chrome |
| Activity screen | activity feature | REFINE | FM-ACTIVITY-001 | Filters + typed rows; real data |
| Settings home | settings screens | REFINE | FM-SETTINGS-001 | Quick tiles + sections |
| Profile overview / dashboard | profile features | REFINE | FM-PROFILE-001/002/003 | OLED + overlay; capability gates |
| Profile tabs morph | existing B6 profile tabs | KEEP | FM-PROFILE-B6-TABS | Preserve flush morph evidence |
| Bottom nav / insets | shell tabs | REFINE | multiple | Safe-area + reachability |
| UI Lab post/hub rows | `modula-ui-lab` | REFINE | all | Prove reconstructions; not second DS |
| FlashList | — | REMOVE/N/A | — | Not installed; do not add in B8 |
| Decorative-only rails | any | REMOVE | — | No non-functional action chrome |

## Decision counts

| Decision | Count |
| --- | --- |
| KEEP | 6 |
| REFINE | 24 |
| NEW | 6 |
| REMOVE/N/A | 2 |
| UNKNOWN | **0** |

## Gate B (matrix) status

**COMPLETE**
