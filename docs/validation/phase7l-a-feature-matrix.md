# Phase 7L-A Feature Matrix

Date: 2026-08-13
Status vocabulary: `WORKING`, `WORKING_WITH_DEFECTS`, `BROKEN`, `NOT_RENDERING`, `INCOMPLETE`, `COMING_SOON`, `INTERNAL_ONLY`, `DUPLICATED`, `STALE`, `MISLEADING`, `SECURITY_BLOCKED`.

| Feature | Visible? | Backend real? | Persistence real? | Web working? | Native working? | Rendering correct? | Security correct? | UI quality | Status | Priority | Repair owner/domain |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Source baseline | Yes | Yes | N/A | N/A | N/A | N/A | Yes | N/A | WORKING | P0 | Release |
| Production identity | Yes | Yes | N/A | Yes | N/A | Yes | Yes | N/A | WORKING_WITH_DEFECTS | P0 | Release |
| Password login API | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Yes | Yes | Defective | WORKING_WITH_DEFECTS | P0 | Auth |
| Email OTP login API | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Yes | Yes | Defective | WORKING_WITH_DEFECTS | P0 | Auth |
| Wrong password | Yes | Yes | N/A | Incomplete UI proof | Incomplete | Yes | Yes | Working | WORKING | P0 | Auth |
| Wrong OTP | Yes | Yes | N/A | Incomplete UI proof | Incomplete | Yes | Yes | Working | WORKING | P0 | Auth |
| Logout | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Yes | Yes | Incomplete | WORKING_WITH_DEFECTS | P0 | Auth |
| Reload restore on web | Yes | Yes | No | No | N/A | N/A | Defective | Broken | BROKEN | P0 | Auth/session |
| Cold browser restore on web | Yes | Yes | No | No | N/A | N/A | Defective | Broken | BROKEN | P0 | Auth/session |
| Password reset | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Yes | Yes | Defective | WORKING_WITH_DEFECTS | P0 | Auth |
| Email verification | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Yes | Yes | Defective | WORKING_WITH_DEFECTS | P0 | Auth |
| Auth UI public routes | Yes | Yes | N/A | Yes | Incomplete | No | Yes | Defective | WORKING_WITH_DEFECTS | P1 | Auth UI |
| Public icon font | Yes | Yes | N/A | Yes | Incomplete | Yes | Yes | Good | WORKING | P1 | Rendering |
| Authenticated icon rendering | Yes | Yes | N/A | Incomplete | Incomplete | Incomplete | Yes | Incomplete | INCOMPLETE | P1 | Rendering |
| Media rendering | Yes | Yes | Yes | No | Incomplete | No | Yes | Broken image | BROKEN | P1 | Media/API |
| Static assets | Yes | Yes | N/A | Yes | N/A | Yes | Yes | Minor MIME issue | WORKING_WITH_DEFECTS | P2 | Web release |
| Browser runtime | Yes | Yes | N/A | No | N/A | No | Yes | Defective | BROKEN | P1 | Web runtime |
| Home | Yes | Yes | Partial | Yes with defects | Incomplete | Media defect | Yes | Dense | WORKING_WITH_DEFECTS | P1 | Home/feed |
| Stories rail/create/view/delete | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Incomplete | Partial block proof | Defective | WORKING_WITH_DEFECTS | P1 | Stories |
| Text post create/edit/delete | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Posts |
| Image post create/render | Yes | Yes | Yes | No render | Incomplete | No | Yes | Broken image | BROKEN | P1 | Posts/media |
| Reactions Like/Love/Laugh/Fire | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Social |
| Comments/replies | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Social |
| Follows | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Social |
| Notifications/activity | Yes | Yes | Yes | Protected redirect | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Activity |
| Bookmarks/saved | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Social |
| Repost | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Social |
| Native share | Yes | N/A | N/A | N/A | Incomplete | Incomplete | Incomplete | Incomplete | INCOMPLETE | P2 | Native/share |
| Block/mute/report | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Moderation |
| Discover people/posts/modules | Yes | Yes | Partial | Yes with defects | Incomplete | Incomplete | Partial | Over-dense | WORKING_WITH_DEFECTS | P1 | Discover/search |
| Search recent/saved | Yes | Yes | Partial | Incomplete UI proof | Incomplete | Incomplete | Partial | Incomplete | WORKING_WITH_DEFECTS | P1 | Search |
| Profile owner/public | Yes | Yes | Partial | Protected redirect for owner | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Profile |
| Edit profile | Yes | Yes | Partial | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | INCOMPLETE | P1 | Profile |
| Drawer | Yes | N/A | N/A | Incomplete stress proof | Incomplete | Incomplete | Yes | Incomplete | INCOMPLETE | P2 | Shell |
| Bottom navigation | Yes | N/A | N/A | Public render only | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P2 | Shell |
| Composer text/photo | Yes | Yes | Partial | Incomplete UI proof | Incomplete | Media defect | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Composer |
| Composer poll/GIF/tools | Yes | Partial | Partial | Incomplete | Incomplete | Incomplete | Partial | Misleading | MISLEADING | P1 | Composer |
| Settings home | Yes | Partial | Partial | Public route renders | Incomplete | Defects | Partial | Defective | WORKING_WITH_DEFECTS | P2 | Settings |
| Appearance modes | Yes | Yes | Yes | API real, UI public render | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P2 | Appearance |
| Surface types | Yes | Yes | Yes | API real, material effect not fully proven | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P2 | Appearance |
| Product Hub route | Yes | Yes | Yes | Protected redirect | Incomplete | Incomplete | Yes | Duplicate entries | DUPLICATED | P1 | Product Hub |
| Product Hub canonical Vault Notes | Yes | Yes | Yes | Protected redirect | Incomplete | Incomplete | Yes | Misleading lifecycle | WORKING_WITH_DEFECTS | P1 | Product Hub |
| Product Hub stale Vault Notes duplicate | Yes | Yes | N/A | Protected redirect | Incomplete | Incomplete | Yes | Duplicate | DUPLICATED | P1 | Product Hub |
| Vault Notes install/enable | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Incomplete | Yes | Async lifecycle unclear | WORKING_WITH_DEFECTS | P1 | Vault Notes |
| Vault Notes note list | Yes | Yes | Yes | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Vault Notes |
| Vault Notes create note | Yes | Yes | Not proven | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | INCOMPLETE | P1 | Vault Notes |
| Tasks module | Yes | Planned | N/A | Visible in registry | Incomplete | Incomplete | Yes | Should be coming soon | COMING_SOON | P2 | Product Hub |
| DIMON Core module | Yes | Inactive namespace | N/A | Visible in registry | Incomplete | Incomplete | Yes | Internal | INTERNAL_ONLY | P2 | Product Hub |
| Search generated modules | Yes | Quarantined | N/A | Visible in registry | Incomplete | Incomplete | Yes | Should be hidden | INTERNAL_ONLY | P1 | Product Hub |
| Module host declarative states | Yes | Yes | Partial | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | INCOMPLETE | P1 | Module runtime |
| Module runtime health | Yes | Yes | Partial | Incomplete UI proof | Incomplete | Incomplete | Yes | Test env/live deployment blockers | WORKING_WITH_DEFECTS | P1 | Module runtime |
| Modula Mail settings | Yes | Yes | Queued | Incomplete UI proof | Incomplete | Incomplete | Partial | Misleading if provisioner implied | WORKING_WITH_DEFECTS | P1 | Mail |
| Security Center sessions | Yes | Yes | Yes | Public route renders | Incomplete | Incomplete | Yes | Incomplete | WORKING_WITH_DEFECTS | P1 | Security |
| Passkeys | Yes | Step-up gated | N/A | Incomplete UI proof | Incomplete | Incomplete | Yes | Missing affordance | INCOMPLETE | P1 | Security/auth |
| TOTP | Yes | Step-up gated | N/A | Incomplete UI proof | Incomplete | Incomplete | Yes | Incomplete | INCOMPLETE | P1 | Security/auth |
| MDHS Avatar Studio | Source-visible | Foundation only | N/A | Not product audited | Incomplete | Incomplete | Yes | Internal | INTERNAL_ONLY | P2 | MDHS |
| Performance | Yes | N/A | N/A | Runtime crawl only | Incomplete | Incomplete | N/A | Incomplete | INCOMPLETE | P2 | Performance |
| Accessibility | Yes | N/A | N/A | Incomplete | Incomplete | Incomplete | N/A | Incomplete | INCOMPLETE | P2 | Accessibility |
| Native iOS build | Yes | N/A | N/A | N/A | Not run on Linux | Incomplete | N/A | Incomplete | INCOMPLETE | P0 | Native |

## Current P0/P1 summary

P0 defects are concentrated in web session persistence and authenticated browser handoff proof. P1 defects are concentrated in production web runtime errors, media rendering, Product Hub duplicate/misleading entries, Vault Notes lifecycle clarity, and missing authenticated/native rendering proof.
