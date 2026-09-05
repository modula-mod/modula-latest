# Shell UI V2 visual evidence

Baseline: `origin/main` at `85cf6566ef3251503f71b311fa508c4ab0bf9b79`.

The `before/` captures were rendered from an isolated checkout of that exact
commit. The `after/` captures were rendered from the mission worktree at a
390 x 844 mobile viewport and, where named `desktop`, a 1280 x 900 viewport.
Browser console errors were collected during the after route tour.

## Priority comparisons

| Surface | Before | After |
| --- | --- | --- |
| Home | `before/home-mobile.png` | `after/home-mobile.png` |
| Settings | `before/settings-mobile.png` | `after/settings-mobile.png` |
| Appearance | `before/appearance-mobile.png` | `after/appearance-mobile.png` |
| Accessibility | `before/accessibility-mobile.png` | `after/accessibility-mobile.png` |
| Activity | `before/activity-mobile.png` | `after/activity-mobile.png` |
| Notification settings | `before/notifications-mobile.png` | `after/notifications-mobile.png` |
| Search / Discover | `before/search-mobile.png` | `after/search-mobile.png` |
| Public profile | `before/profile-mobile.png` | `after/profile-mobile.png` |
| Composer gate | `before/composer-mobile.png` | `after/composer-mobile.png` |
| Product Hub | `before/product-hub-mobile.png` | `after/product-hub-mobile.png` |
| Module detail | `before/module-detail-mobile.png` | `after/module-detail-mobile.png` |
| Vault Notes host | `before/vault-notes-root-mobile.png` | `after/vault-notes-root-mobile.png` |
| Vault Notes editor route | `before/vault-notes-editor-mobile.png` | `after/vault-notes-editor-mobile.png` |

## Long-screen and desktop evidence

- Settings, Accessibility, Profile, Product Hub, and Module Detail have `top`
  and `scrolled` mobile captures.
- Vault Notes host/editor, Settings, Product Hub, and Module Detail have desktop
  captures.
- The local catalogue exposes Vault Notes as available but not installed. The
  Vault host/editor images therefore prove generic compact unavailable/install
  chrome, not the released 1.7.0 product screens. That limitation is recorded
  as an open visual gate in the acceptance report.

## Appearance and accessibility matrices

- `settings-{light,dark,oled,large,accessibility}-mobile.png`
- `lab-buttons-{light,dark,oled,large,accessibility}-mobile.png`
- `lab-fields-{light,dark,oled,large,accessibility}-mobile.png`
- `lab-settings-{light,dark,oled,large,accessibility}-mobile.png`

The UI Lab is development-only. It exercises the canonical controls that
product TSX and shell routes consume; it is not linked from consumer chrome.
