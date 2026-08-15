# Prototype brief: Product Hub

**Phase:** 7M-B only. Not authorised in 7M-A.

First-party software marketplace, not a registry debugger.

First viewport answers: What is this? Who made it? Is it available? Why is it useful? What do I press?

Canonical module identity from Phase 7L controls deduplication. Releases never become duplicate visible products. Vault Notes looks like a desirable first-party module.

## Hierarchy

Artwork / icon → name → publisher / trust → primary install/open/update → short description → screenshots → what’s new → capabilities / permissions → version → secondary trust & technical details.

## Must prove

- Module cards and artwork
- Trust presentation without leaking internal IDs on the card
- Install states from the canonical projection
- Navigation
- Grids / lists
- Detail presentation
- Sheets (install preview)
- Progress

## Must not

- Showing checksums, backend mode, or fixture module IDs in the primary card
- Duplicate Vault Notes identities
- Changing install/enable API behaviour

Existing owners: `ModuleCatalogueCard`, `ModuleStatusPill`, `InstallPreviewSheet`, Product Hub screens.
