# Phase 7M-B2 visual references

Do not clone. Borrow hierarchy and behaviour; keep Modula materials, teal accent, and generic Module Host.

## HOME

Reference A — feed information hierarchy:
Dense social stream. Author identity is a small avatar + name + handle in one row. Text and media dominate. Chrome is thin.

Reference B — Story treatment:
Horizontal rail above the feed, circles with a live ring, not a dashboard widget.

Reference C — scroll / navigation:
Floating bottom chrome that does not cover the last post. Drawer is a spatial overlay, not a second app.

WHAT WE BORROW
Compact post padding, 36pt avatar, tight action row, stories above content.

WHAT WE REJECT
Card-in-card dashboard posts, oversized chrome, technical metadata in the stream.

HOW MODULA DIFFERS
Protocol-independent SocialPost. Appearance runtime (light/dim/dark/OLED, surface types) instead of a single skin.

## AUTHENTICATION

Reference A — field density:
Email then password as a short stack. Errors sit on the field, not a banner novel.

Reference B — OTP:
Native one-time-code cells with system autofill, not six fake boxes glued to a hidden input poorly.

Reference C — keyboard:
Return key advances or submits. Password reveal is labelled.

WHAT WE BORROW
Short hierarchy, OTP autofill, loading labels on the same button.

WHAT WE REJECT
Passkey/Apple buttons when those backends are not enabled.

HOW MODULA DIFFERS
Real Greenfield auth. External networks stay under Settings → Connections.

## PRODUCT HUB

Reference A — artwork first:
Icon/art, product name, publisher, one-line usefulness, then Install.

Reference B — store search:
A single search field and category rail. Featured, then a list.

Reference C — installed vs available:
The primary action is Install or Open. Technical trust is a later screen.

WHAT WE BORROW
Consumer card hierarchy. Free/Available without checksums.

WHAT WE REJECT
Module IDs, Greenfield-managed, firstParty, checksum, backend id on the card.

HOW MODULA DIFFERS
One canonical Vault Notes product. Generic Module Host after Open.

## VAULT NOTES

Reference A — install review:
Permissions in human language. Data ownership sentence. One Install button.

Reference B — progress:
Checks appear only after the underlying operation succeeds.

Reference C — open:
`/module/digital.modula.vault-notes` through the generic host. No special screen.
