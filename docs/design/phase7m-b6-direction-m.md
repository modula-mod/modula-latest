# Phase 7M-B6 — Direction M refined

Direction M remains: **Dense Social OS + Native Editorial + Spatial chrome only where useful**.

B5 was promising and not approved. B6 matures the Product Hub and overlay architecture. It does not start 7M-C and does not deploy production.

## Visual direction

Content hierarchy instead of container hierarchy.

Product Hub is an editorial marketplace, not a registry:

- Featured hero (exceptional)
- Compact product rows (workhorse)
- Horizontal shelves
- Curated collections
- Category tiles only in search browse

Module Detail is a continuous product page:

- Identity + Install
- Preview
- What’s New
- Privacy & Access
- Trust & Technical Details (secondary)

Cards are reserved for media and grouped interactive content.

## Overlay invariant

Every actionable Modula sheet:

```
HEADER   stable
BODY     independently scrolls
FOOTER   fixed above safe area
```

The primary CTA never lives at the end of an unbounded ScrollView.

When a sheet is open, shell navigation recedes (`setShellChromeHoldObscure`).

## Search

Option 2, explicit state machine:

```
IDLE_LARGE_HEADER → COMPACT_HEADER → SEARCH_EXPANDING → SEARCH_ACTIVE → SEARCH_RESULTS
                 ↘ CANCEL → SEARCH_COLLAPSING ↗
```

Web prioritises focus, Escape, and keyboard over identical motion.

## Production

```
PRODUCTION DEPLOYED = NO
7M-C STARTED = NO
```

Vault Notes candidate identity remains `digital.modula.vault-notes` / `1.1.0` / `modula-mod/modula-vault-notes`. Production `0.2.0` is unchanged.
