# Phase 7B Module Marketplace Inspiration

Status: inspiration only. Do not pixel-copy these products.

Phase 7B maps external product patterns into Modula's Product Hub, module detail, permission review, Settings -> Modules, contribution hosts, and Vault Notes surfaces. All UI must use Modula tokens, primitives, and platform adapters.

## Sources Studied

- Apple App Store product pages: https://developer.apple.com/app-store/product-page/
- Apple App Store app privacy: https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/
- Apple HIG lists and tables: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- TestFlight overview: https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/
- TestFlight public app page behavior: https://testflight.apple.com/
- GitHub Marketplace listing requirements: https://docs.github.com/en/apps/github-marketplace/listing-an-app-on-github-marketplace
- GitHub Marketplace app permissions: https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-github-marketplace-for-your-organizations
- GitHub publisher verification: https://docs.github.com/en/apps/github-marketplace/github-marketplace-overview/applying-for-publisher-verification-for-your-organization
- Linear integration directory: https://linear.app/docs/integration-directory
- Linear third-party application approvals: https://linear.app/docs/third-party-application-approvals
- Notion connections gallery: https://www.notion.com/connections
- Notion connections management: https://www.notion.com/help/add-and-manage-connections-with-the-api
- Notion API overview: https://developers.notion.com/guides/get-started/overview
- Raycast extensions manual: https://manual.raycast.com/extensions
- Raycast install an extension: https://developers.raycast.com/basics/install-an-extension
- Slack add apps: https://slack.com/help/articles/202035138-Add-apps-to-your-Slack-workspace
- Slack app approval: https://slack.com/help/articles/222386767-Manage-app-approval-for-your-workspace
- Slack app settings and permissions: https://slack.com/help/articles/1500009181142-Manage-app-settings-and-permissions

## Patterns to Adapt

### Information hierarchy

- Lead with module identity: icon, name, publisher, trust state, install state, and one-line value.
- Keep developer/provenance details below the user decision layer.
- Separate "what it does" from "what it can access".

### Catalogue cards

- Cards need compact scan fields: icon, name, publisher, short description, category, compatibility, trust, version, price state, install state.
- Use status text, not color alone.
- Avoid fake available states. Coming-soon and incompatible items must not look installable.

### Editorial and featured modules

- Use a horizontal editorial rail, not an auto carousel.
- Featured cards can be larger, but must still show install/trust state and work under reduced motion, reduced transparency, high contrast, OLED, and large text.

### Trust and publisher presentation

- Borrow the verified-publisher pattern from GitHub and Linear.
- Trust display should distinguish first-party, reviewed community, unreviewed, quarantined, incompatible, and unavailable.
- Publisher details belong in detail screens and permission review, not only card badges.

### Permission disclosure

- GitHub and Slack installation flows make requested access visible before install.
- Modula should show module permissions, collection access, contributed surfaces, dependencies, and risk level before installation.
- Permission increases must route through update review instead of automatic update.

### Version and release notes

- TestFlight makes build/update state and testing notes prominent.
- Modula detail should show installed version, available version, release notes, compatibility, checksum/provenance developer disclosure, and rollback/update status.

### Installation states

- Required states: Available, Installed, Disabled, Update available, Configuration required, Incompatible, Quarantined, Coming soon.
- Installation progress should show specific stages: Resolving, Reviewing permissions, Installing, Registering schemas, Registering tools, Finishing, Installed, Failed.
- Never leave an indefinite spinner without job status.

### Update states

- Updates should expose release notes and permission changes.
- Permission-increasing updates require explicit review.
- Automatic updates can exist only inside module preference boundaries.

### Settings grouping

- iOS Settings and Notion Connections both group related controls.
- Settings -> Modules should use grouped status, version, permissions, settings, contributions, data, updates, troubleshooting, and danger-zone sections.
- Avoid debug tables in user-facing management.

### Destructive uninstall flow

- Slack and enterprise approval patterns make admin impact explicit.
- Modula uninstall preview must show dependants, record count, jobs, contributions, and data choices.
- Default to keep data. Destructive deletion requires recent authentication, second confirmation, typed module name or native equivalent, and async completion state.

### Empty states

- Empty catalogue sections should explain why they are empty: no compatible modules, no installed modules, no updates, offline catalogue, or registry unavailable.
- Vault Notes empty states should offer Create note, Create folder, or Save a post to Vault based on source context.

### Search and filters

- Notion and Raycast emphasize fast search plus category browsing.
- Product Hub search must call registry APIs and filter by extension kind, category, installed, compatible, first-party, and update state.
- Search should not fabricate unavailable registry items as installable.

### Extension-kind navigation

- Product Hub becomes the canonical marketplace entry.
- Sections: Featured, Modules, Tools, Functions, Plugins, Connections, Widgets, Installed, Updates, Coming Soon, Developer.
- Settings and profile/module surfaces deep-link into Product Hub instead of creating competing marketplaces.

### Compact mobile layouts

- Keep module cards dense but legible.
- Use single-column scan cards on narrow phones, with status and action grouped near the identity row.
- Use sheets for install preview and permissions; avoid large modal dashboards on mobile.

## Modula-Specific Rules

- Product Hub is the canonical extension marketplace.
- Marketplace is a Product Hub section, not a separate architecture.
- Vault Notes remains an external module repository and renders through declarative views.
- DIMON commercial fields are architecture-only: Free, Included, Coming soon, Not available. No fake prices, balances, wallets, purchases, or subscriptions.
- Connections are separate from Modula accounts.
- GitHub unavailability must not break installed modules already registered in Greenfield.

