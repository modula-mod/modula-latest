# Post Experience V2 — founder reference map

Phase: **7M-B7**
Status: **implementation contract**

The founder boards are interaction references, not a theme to copy. Their durable contribution is a single content-first grammar that survives Light, Dim, Dark, OLED, native, solid, glass, glay, and minimalSpatial appearances.

## Reference map

| IDEA | USE | MODULA ADAPTATION | DO NOT COPY | IMPLEMENTATION LOCATION |
| --- | --- | --- | --- | --- |
| Media is the hero | Image and video occupy the eligible post edge | One `PostShell` supplies author, caption, actions, comments, and state around the media renderer | Permanent dark theme or a photograph nested in padded cards | `src/features/social/posts/components/post-shell.tsx`, `renderers/*` |
| Compact right action rail | Reaction, comments, save, share, menu remain reachable | Discrete 44pt backed controls choose semantic media-overlay tokens; they do not form one tall frosted slab | Giant BlurView rectangle or unlabelled hit targets | `components/post-action-rail.tsx`, `components/post-surface.tsx` |
| Rail swipe down | Open contextual actions without stealing feed scrolling | Downward pan is owned only by the rail; web also has an explicit menu button | Whole-post vertical gesture or fake menu actions | `components/post-action-rail.tsx`, `interactions/post-context-menu.tsx` |
| Like hold and horizontal browse | Reaction choice follows coarse pointer/finger movement | Long press opens the backed reaction set; nearest slot enlarges; buttons remain keyboard-selectable | Client-only reaction types, tiny targets, or precision tapping after hold | `interactions/reaction-picker.tsx`, `state/post-interaction-types.ts` |
| Bottom pull | Comments rise spatially from every eligible post | Only the bottom activation region owns the upward pan; the comments sheet snaps closed, peek, partial, full | Using the same gesture to open a player | `components/post-shell.tsx`, `interactions/comments-surface.tsx` |
| Partial and full comments | Preview first, thread on demand | Partial shows thread context; full provides scrolling comments and a sticky composer with retry/empty/error states | A second comments page disconnected from the post | `interactions/comments-surface.tsx`, `features/feed/screens/PostDetailScreen.tsx` |
| Carousel awareness | Horizontal movement changes only media | Native horizontal paging plus a restrained count/dot indicator | Capturing vertical feed gestures or oversized pagination chrome | `renderers/carousel-post-renderer.tsx` |
| Video expands deliberately | Feed play/pause and explicit immersive player | Tap controls playback; expand opens a distinct full-screen presentation; web uses `expo-video` | Scaling the feed card or mapping comments pull to expand | `renderers/video-post-renderer.tsx`, `interactions/media-full-player.tsx`, `platform/ui/video/*` |
| Music artwork opens player | Separate playback from comments | Renderer foundation remains available, but production exposure waits for a canonical audio media contract and player capability | Inferring “music” from an image title or displaying non-functional transport controls | `renderers/music-post-renderer.tsx`, `types/resolve-post-content.ts` |
| One overlay at a time | Avoid reaction/menu/comments collisions | A typed interaction mode gates mutually exclusive overlay transitions; playback may coexist only where explicit | Five independent booleans controlling competing layers | `state/post-interaction-types.ts`, `state/post-interaction-machine.ts`, `interactions/post-interaction-context.tsx` |
| Quiet chrome | Content remains primary | Adaptive scrims and semantic backed controls protect contrast on bright, dark, and detailed media | Random opaque rectangles, generic gradients, or glass for its own sake | `components/post-header.tsx`, `components/post-caption.tsx`, `components/post-surface.tsx` |

## Canonical gesture and desktop contract

| Target | Touch / pointer gesture | Keyboard / desktop equivalent | Result |
| --- | --- | --- | --- |
| Action rail | Swipe down | Menu button, Enter/Space | Context menu |
| Post bottom zone | Drag up | Comments button, Enter/Space | Comments sheet |
| Reaction | Long press and horizontal movement | Click-hold or open then arrow/pointer selection | Backed reaction picker |
| Carousel media | Horizontal swipe | Horizontal scroll | Previous / next media |
| Video expand | Tap expand | Expand button | Full player |
| Music artwork or strip | Tap | Player button | Full player when canonical audio support lands |

## Formal requirements

- **ONE SURFACE:** feed, profile, thread, and detail share the same semantic Post shell.
- **CAROUSEL AWARE:** horizontal media navigation never owns normal vertical feed movement.
- **CLEAR HIERARCHY / CONTENT FIRST:** author and interaction chrome support the content rather than surrounding it with card soup.
- **GESTURE BASED / MUSCLE MEMORY:** gestures have narrow, stable target regions and visible button equivalents.
- **FLUID / ACCESSIBLE:** selection tolerates coarse movement; actions expose labels, selected states, keyboard focus, Escape, and focus return.
- **IMMERSIVE WHEN REQUESTED:** full player is explicit and distinct from the feed presentation.
- **NON-INTRUSIVE BY DEFAULT:** closed comments and menus do not consume post space.
- **REDUCE MOTION:** reaction uses highlight rather than travel, sheets use a short transition, and full player uses a minimal fade.

## Backend contract boundary

The canonical reaction contract persists exactly:

`like`, `love`, `laugh`, `fire`, `celebrate`, `insightful`, `support`, `curious`.

Primary and “more” presentation may group those values differently, but no additional reaction value may be saved. The current social media asset contract persists image and video assets; it does not identify an audio asset or track metadata. B7 therefore removes the previous image-title heuristic and does not claim production music persistence.
