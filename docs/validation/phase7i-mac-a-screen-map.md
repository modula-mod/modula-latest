# Phase 7I-MAC-A — Native Screen Map

Date: 2026-08-10  
Simulator: iPhone 17 Pro (`0727E2F0-8528-44DA-9F4C-7B5F7394096B`) · iOS 27.0  
Session under test: **guest** (drawer: “Sign in to Modula” / “Local prototype account”)  
API: `EXPO_PUBLIC_DATA_SOURCE=remote` + `EXPO_PUBLIC_API_URL=http://127.0.0.1:4020` (SSH tunnel **not established** — Mac pubkey rejected)

Statuses: `WORKING` | `FUNCTIONAL_BUT_BAD_UI` | `BROKEN_LAYOUT` | `MISSING_DATA` | `API_BLOCKED` | `NATIVE_CRASH` | `WEB_ONLY` | `NOT_IMPLEMENTED`

| Surface | Status | Evidence / notes |
| --- | --- | --- |
| Cold launch / splash | WORKING | Teal splash + logo; Metro bundle loads |
| Auth — Login | API_BLOCKED / partial | Route `modula://sign-in` exercised; real credential smoke blocked without tunnel. Public API returns `503 MAINTENANCE` (intentional). |
| Auth — Register | API_BLOCKED / partial | Route `modula://register` exercised; server policy not live-probed through tunnel. |
| Home (guest) | WORKING + API_BLOCKED | Header, Following/For You/Modules, composer strip, floating tab bar, Create `+` present. Feed shows offline/skeleton when `127.0.0.1:4020` refuses. |
| Home scrolled | PARTIAL | Sticky modes not fully photographed; stick handoff remains high-risk geometry (shared track, not Host). |
| Stories (Home rail) | MISSING_DATA / expected for guest | Query `enabled` only when `signedIn`. Guest → empty people → rail not mounted. Not a layout clip in this session. |
| Stories (product/presence) | FUNCTIONAL_BUT_BAD_UI | Rail returns `null` when `people.length === 0` — no honest empty UI on standalone surfaces. |
| Composer | WORKING (UI) | `modula://compose` navigable; tool execution against API blocked. |
| Discover | API_BLOCKED | CFNetwork errors to `/v1/discover`. |
| Activity | API_BLOCKED | Navigable shell; data blocked. |
| Profile | WORKING (guest shell) | Tab profile reachable; remote profile data blocked. |
| Board | API_BLOCKED / navigable | Drawer + deep link. |
| Drawer | WORKING | `modula:///?openDrawer=1` opens; sections Personal / Product / System; no freeze observed on open. |
| Settings | WORKING (UI) | Deep link `modula://settings`. |
| Appearance | WORKING (UI) | Deep link `modula://settings/appearance` — live effect audit incomplete without prolonged interaction. |
| Product Hub | WORKING (UI) / MISSING_DATA | Shell navigable; marketplace data API blocked. |
| Module detail | API_BLOCKED | Modules list/detail need registry API. |
| Module Host / Vault Notes | API_BLOCKED | Install/enable/open not exercised without tunnel. |
| Tab bar | WORKING | Floating glass pill + Create disc; pinned to physical bottom visually (no black gap observed). |
| Feed segmented controls | WORKING | All three labels visible; Following selected. Sticky Host exclusion respected in code. |
| Reels / Search / Saved / Connections | NOT fully photographed | Routes exist; map as navigable stubs pending tunnel session. |
| Messages | Not in primary before set | Route exists; defer detailed audit. |

## Stories root cause (this Mac session)

```text
guest session
→ useStoriesRailQuery disabled
→ storiesPeople = []
→ Home presence gate requires length > 0
→ PresenceStoriesRail not mounted
```

When **signed in** (not yet proven here), Home synthesizes an owner “You / Add Story” stub if the rail API returns empty — see `HomeFeedScreen.tsx`. Prior Phase 7F-B “no people prop” gap is closed in this tree; remaining risk is **API empty vs layout** and **standalone rail null empty state**.

## Network honesty

With tunnel down, Home showed “Could not load this surface / You appear to be offline / Retry” and later skeleton states. UI remained interactive (tabs, drawer). Matches Phase 56/57 intent for failure handling.
