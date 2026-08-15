# Modula Beta Feature Manifest

Date: 2026-08-13
Allowed beta states: `BETA_SUPPORTED`, `COMING_SOON`, `INTERNAL_ONLY`.

| Feature | Visible surface | Beta state | Notes |
| --- | --- | --- | --- |
| Password login | Auth | BETA_SUPPORTED | API works; browser handoff still requires Phase 7L-B E2E proof |
| Email OTP login | Auth | BETA_SUPPORTED | API works; browser handoff still requires Phase 7L-B E2E proof |
| Password reset | Auth | BETA_SUPPORTED | API works with valid recovery token |
| Email verification | Auth | BETA_SUPPORTED | API works |
| Web reload/cold restore | Auth/session | BETA_SUPPORTED | Canonical web session bundle persists login across reload and cold restore |
| Home feed | Home | BETA_SUPPORTED | Works with remaining visual density defects |
| Stories | Home/Stories | BETA_SUPPORTED | API lifecycle works; native visual proof pending |
| Text posts | Composer/feed | BETA_SUPPORTED | Text publish is real; poll/GIF/link cards are Coming Soon |
| Image posts | Composer/feed | BETA_SUPPORTED | Publish works; same-site media headers allow browser render |
| Poll / GIF composer tools | Composer | COMING_SOON | Visible as Coming Soon; no fake draft attachment |
| Reactions Like/Love/Laugh/Fire | Feed/post | BETA_SUPPORTED | API transitions work; browser UI proof pending |
| Comments/replies | Post detail | BETA_SUPPORTED | API works with defects; browser UI proof pending |
| Follows | Profile/feed | BETA_SUPPORTED | API works; browser UI proof pending |
| Notifications/activity | Activity | BETA_SUPPORTED | API works with defects; protected browser proof pending |
| Bookmarks/saved | Saved/feed | BETA_SUPPORTED | API works; browser UI proof pending |
| Repost | Feed/post | BETA_SUPPORTED | API works; browser UI proof pending |
| Native share | Share sheet | BETA_SUPPORTED | Native proof pending |
| Block/mute/report | Moderation | BETA_SUPPORTED | API enforcement works with defects; browser UI proof pending |
| Discover | Discover | BETA_SUPPORTED | Public route renders with density/runtime defects |
| Search | Discover/Search | BETA_SUPPORTED | Universal search uses the real Greenfield search API |
| Profile | Profile | BETA_SUPPORTED | Owner and public profile views use Greenfield state |
| Edit Profile | Profile | BETA_SUPPORTED | Display name, handle, bio, location, website, and focus persist through `/v1/profiles/me` |
| Settings | Settings | BETA_SUPPORTED | Beta-visible rows navigate; unready security controls are Coming Soon |
| Appearance | Settings | BETA_SUPPORTED | API preferences work; full visual material proof pending |
| Security Center | Settings | BETA_SUPPORTED | Sessions list/revoke are real; passkeys/TOTP/recovery codes are Coming Soon |
| Passkeys | Security | COMING_SOON | Gated in Security settings; no beta registration/login path |
| TOTP | Security | COMING_SOON | Gated in Security settings; no beta setup path |
| Recovery Codes | Security | COMING_SOON | Gated in Security settings |
| Modula Mail | Settings | BETA_SUPPORTED | Settings show true mailbox/provisioner state and never claim a live inbox when the provisioner is disabled |
| Product Hub | Marketplace | BETA_SUPPORTED | One canonical product card per moduleId; stale duplicates quarantined |
| Vault Notes | Product Hub/module host | BETA_SUPPORTED | Canonical module is installable; disposable-DB CRUD lifecycle proven |
| Tasks | Product Hub | COMING_SOON | Planned, not installable |
| CRM | Product Hub | COMING_SOON | Planned, not installable |
| GAIA Atlas | Product Hub | COMING_SOON | Planned, not installable |
| DIMON Core | Product Hub/DIMON | INTERNAL_ONLY | Inactive namespace, not user installable |
| Generated Search modules | Product Hub | INTERNAL_ONLY | Quarantined generated module entries must not appear as user products |
| MDHS Avatar Studio | MDHS/internal | INTERNAL_ONLY | Foundation-only; do not expose as production-ready |
| Developer UI Lab | Settings/Developer | INTERNAL_ONLY | Developer-only |
| AASA/assetlinks | Web/native association | BETA_SUPPORTED | AASA MIME needs verification/fix |
