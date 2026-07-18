# X / Twitter inspiration remap

**Status:** design inspiration only  
**Rule:** study interaction density and social-reading craft, then reimplement on Modula primitives. Modula is Profile-OS plus modules, not an X clone.

---

## What to learn

### Content-first feed densification

X is useful as a reference for how quickly a dense feed can be scanned when text, media, avatar, metadata, and action rows are tightly ordered.

Modula remap:

- Text breathes: post copy keeps readable line height and enough horizontal space.
- Media glows: images and video can carry the strongest visual weight while text stays calm.
- Links contain: previews should look deliberate, not like generic heavy cards.
- The feed can become denser without becoming cramped when separators, typography, and action rows carry hierarchy.

### Following / For You / Modules mode bar

The segmented mode bar pattern can teach quick context switching.

Modula remap:

- **Following**: people and communities the user asked to see.
- **For You**: discovery and recommendation previews with honest ranking controls.
- **Modules**: registered module streams, workspaces, and Profile-OS surfaces.

The third mode is the product difference. Modula does not end at social ranking; modules and Profile-OS become first-class feed contexts.

### Icon-forward tab density

X shows that mobile navigation can carry many affordances with icon-forward density.

Modula remap:

- Use icon density as inspiration for compact routes, not as permission to overload the shell.
- Preserve Modula tab meaning: Home, Discover, Create, Board, Activity, Profile, and module entry points.
- Keep labels, hints, and accessibility states available when icon-only chrome is used.

### Hairline separators, not heavy cards

Dense social surfaces work best when every post is not a heavy card.

Modula remap:

- Prefer hairline separators for feed rows and social lists.
- Reserve raised cards for modules, dashboards, previews, or explicit grouped content.
- OLED black canvas in the current theme already supports this direction: low-chrome rows can sit on a deep canvas while media and Modula Teal accents provide depth.

### Action row micro-feedback

X makes engagement feel responsive through small state changes.

Modula remap:

- Tap states should acknowledge intent quickly.
- Reactions, reposts, saves, and comments can use subtle count/state feedback.
- Micro-feedback must not fake remote success. Preview surfaces should show local intent or disabled states clearly.

---

## Brand translation

Modula uses **Modula Teal `#369CAA`** as the brand accent through theme tokens. Do not substitute X Blue or tune the app toward an X-like palette.

Use the inspiration to reinforce:

- Profile-OS as the identity and presentation layer.
- Modules as the extensibility layer.
- Greenfield social as one foundation, not the whole product.
- OLED black canvas as a natural fit for low-chrome, hairline-separated feeds.

---

## Forbidden

- Do not copy the Chirp font.
- Do not copy or resemble the X logo.
- Do not recreate X Blue as the Modula brand.
- Do not copy Bluesky ALF or social-client implementation patterns while remapping this work.
- Do not import X, Twitter, Bluesky, or AT Protocol design-system dependencies into Modula UI.
