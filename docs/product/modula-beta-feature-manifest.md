# Modula Beta Feature Manifest

Date: 2026-08-13
Allowed beta states: `BETA_SUPPORTED`, `COMING_SOON`, `INTERNAL_ONLY`.

| Feature | Visible surface | Beta state | Notes |
| --- | --- | --- | --- |
| Password login | Auth | BETA_SUPPORTED | API works; browser handoff still requires Phase 7L-B E2E proof |
| Email OTP login | Auth | BETA_SUPPORTED | API works; browser handoff still requires Phase 7L-B E2E proof |
| Password reset | Auth | BETA_SUPPORTED | API works with valid recovery token |
| Email verification | Auth | BETA_SUPPORTED | API works |
| Web reload/cold restore | Auth/session | BETA_SUPPORTED | Supported promise is currently broken and must be repaired before beta confidence |
| Home feed | Home | BETA_SUPPORTED | Works with defects; media render defect is P1 |
| Stories | Home/Stories | BETA_SUPPORTED | API lifecycle works with defects; browser/native visual proof pending |
| Text posts | Composer/feed | BETA_SUPPORTED | API works with defects; browser UI proof pending |
| Image posts | Composer/feed | BETA_SUPPORTED | Publish works, web render blocked by media headers |
| Reactions Like/Love/Laugh/Fire | Feed/post | BETA_SUPPORTED | API transitions work; browser UI proof pending |
| Comments/replies | Post detail | BETA_SUPPORTED | API works with defects; browser UI proof pending |
| Follows | Profile/feed | BETA_SUPPORTED | API works; browser UI proof pending |
| Notifications/activity | Activity | BETA_SUPPORTED | API works with defects; protected browser proof pending |
| Bookmarks/saved | Saved/feed | BETA_SUPPORTED | API works; browser UI proof pending |
| Repost | Feed/post | BETA_SUPPORTED | API works; browser UI proof pending |
| Native share | Share sheet | BETA_SUPPORTED | Native proof pending |
| Block/mute/report | Moderation | BETA_SUPPORTED | API enforcement works with defects; browser UI proof pending |
| Discover | Discover | BETA_SUPPORTED | Public route renders with density/runtime defects |
| Search | Discover/Search | BETA_SUPPORTED | API recent/saved works with defects |
| Profile | Profile | BETA_SUPPORTED | API profiles work; owner/public browser proof pending |
| Edit Profile | Profile | BETA_SUPPORTED | Source/API path present; persistence proof pending |
| Settings | Settings | BETA_SUPPORTED | Public settings render; all rows need browser/native click audit |
| Appearance | Settings | BETA_SUPPORTED | API preferences work; full visual material proof pending |
| Security Center | Settings | BETA_SUPPORTED | Sessions API works; passkeys/TOTP are gated |
| Passkeys | Security | COMING_SOON | Step-up/API readiness exists, but visible production affordance is incomplete |
| TOTP | Security | COMING_SOON | Step-up/API readiness exists, but full setup flow not beta-proven |
| Recovery Codes | Security | COMING_SOON | Needs browser proof or gating |
| Modula Mail | Settings | BETA_SUPPORTED | Identity API queues state; provisioner disabled, so copy must be precise |
| Product Hub | Marketplace | BETA_SUPPORTED | Duplicates/misleading unavailable states must be repaired |
| Vault Notes | Product Hub/module host | BETA_SUPPORTED | Canonical module is published/installable/enabled; note CRUD proof incomplete |
| Tasks | Product Hub | COMING_SOON | Planned, not installable |
| CRM | Product Hub | COMING_SOON | Planned, not installable |
| GAIA Atlas | Product Hub | COMING_SOON | Planned, not installable |
| DIMON Core | Product Hub/DIMON | INTERNAL_ONLY | Inactive namespace, not user installable |
| Generated Search modules | Product Hub | INTERNAL_ONLY | Quarantined generated module entries must not appear as user products |
| MDHS Avatar Studio | MDHS/internal | INTERNAL_ONLY | Foundation-only; do not expose as production-ready |
| Developer UI Lab | Settings/Developer | INTERNAL_ONLY | Developer-only |
| AASA/assetlinks | Web/native association | BETA_SUPPORTED | AASA MIME needs verification/fix |
