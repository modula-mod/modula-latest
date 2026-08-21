# Phase 7M-B8 — Overlay map (Gate B)

Classification of every overlay/surface touched by founder mockups. Aligns with B6 overlay taxonomy (`SHEET` / `POPOVER` / `CONTEXT_MENU` / `FULLSCREEN` / `INLINE`).

| Overlay | Classification | Trigger | Dismiss | Mockups | Implementation locus |
| --- | --- | --- | --- | --- | --- |
| Action Rail (resting) | INLINE | Always on media posts | n/a | FM-POST-*, FM-ACTION-RAIL-001 | `post-action-rail` |
| Reaction picker bar | POPOVER | Long-press Like | Release/select / outside / Escape | FM-REACTION-001 | `reaction-picker` |
| Custom reactions panel | SHEET / POPOVER | Tap `+` on picker | Close / select | FM-REACTION-001 | `custom-reaction-picker` |
| Context menu (rail morph) | CONTEXT_MENU | Swipe/drag down on rail | Tap outside / select / back | FM-CONTEXT-MENU-001, FM-ACTION-RAIL-001 | `post-context-menu` |
| Comments sheet | SHEET | Swipe up bottom / comment affordance | Drag down / close | FM-POST-001/003/006 | `comments-surface` |
| Media full player | FULLSCREEN | Expand / swipe-up media | Collapse chevron / swipe down | FM-VIDEO-001, FM-MUSIC-* | `media-full-player` |
| Install preview | SHEET | Install/Open CTA on hub/detail | Close | FM-HUB-001, FM-VAULT-* | `InstallPreviewSheet` |
| Profile overview overlay | POPOVER / SHEET | Avatar / Overview | Outside / route back | FM-PROFILE-002/003 | profile overlay comps |
| Choose unlock method | SHEET | App Lock settings | Close | FM-APPLOCK-002 | NEW app-lock sheet |
| App Lock unlock (PIN/Password/Pattern/Bio) | FULLSCREEN | Cold start / auto-lock / step-up | Success unlock | FM-APPLOCK-001/003 | NEW unlock screens |
| Step-up unlock required | POPOVER / modal | Sensitive action | Cancel / success | FM-APPLOCK-004 | NEW step-up |
| Privacy Lock Mode | FULLSCREEN | Privacy lock enabled | Unlock Now | FM-APPLOCK-004 | NEW |
| Settings search (morph) | INLINE → expanded | Focus search | Blur/cancel | FM-SETTINGS-001 | existing search chrome |
| Activity filters | INLINE chips | Tap | n/a | FM-ACTIVITY-001 | Activity screen |

## Z-index / layering rules (B8)

1. Media content (base)  
2. Resting chrome (header, caption, rail, social proof)  
3. Dim/scrim when transient overlays open  
4. POPOVER (reactions) above rail  
5. CONTEXT_MENU above scrim  
6. SHEET (comments/install) above context  
7. FULLSCREEN player / App Lock above all app chrome  
8. System alerts remain OS-owned  

## Reduce Motion

- Morph rail→menu → cross-fade + instant layout when Reduce Motion on.  
- Reaction hover scale → opacity only.  
- Full player → hard cut optional.

## Gate B (overlay map) status

**COMPLETE**
