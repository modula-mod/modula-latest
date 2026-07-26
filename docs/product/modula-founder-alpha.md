# Modula Founder Alpha

Status: Phase 7C product definition
Target release: Modula Founder Alpha 0.1

## Primary Promise

Modula is a social operating system where a user's profile, social graph, tools, and modules form one personal digital platform.

The Alpha must feel like one product, not a set of prototypes. The profile is the center, the social loop gives the product daily use, the Board gives the user a private operating surface, and Product Hub plus Vault Notes prove that modules are first-class surfaces.

## Product Loop

Founder Alpha must support this loop end to end:

1. Join Modula.
2. Verify the account.
3. Choose a handle and basic profile.
4. Find people and topics.
5. Follow people.
6. Read the feed.
7. Publish a post.
8. React, comment, reply, repost, quote, save, and share.
9. Receive and clear activity.
10. Edit the profile.
11. Use the Board.
12. Open Product Hub.
13. Install and enable Vault Notes.
14. Use Vault Notes as a private module.
15. Adjust privacy, notification, accessibility, and appearance settings.
16. Sign out, return later, sign in, and recover state.

## Primary User Journeys

Join Modula:

- Welcome explains Modula as a social operating system.
- Create account uses Greenfield auth.
- Verification is required.
- Handle selection is required.
- Privacy acknowledgement is required.
- Avatar, interests, and suggested follows can be skipped.

Find people:

- Discover includes People and Topics.
- Suggestions explain why they appear without exposing private relationships.
- Search supports people, handles, posts, topics, modules, tools, and functions.

Follow people:

- Follow and unfollow are account-backed.
- Relationship state is visible on profile, feed, and suggestions.
- Block, mute, and remove follower are supported where applicable.

Read and respond:

- Home has distinct Following, For You, and Modules modes.
- Posts expose reply, reaction, repost, quote, save, share, and more actions.
- Optimistic actions visibly roll back on failure.

Publish something:

- Composer supports text first.
- Media, camera, video, GIF, poll, and module tools are presented through the extensible plus drawer.
- Draft state survives route changes and offline periods.
- Publishing reports progress, success, and failure.

Build a profile:

- Owner, public visitor, private preview, editor, and customization preview share one profile contract.
- Profile header supports avatar, Focus Halo, cover, display name, handle, bio, optional pronouns, optional location, website, trust state, counts, follow controls, and actions.
- Profile tabs are registry-driven.

Organise personal work:

- Board answers: what do I need, use, or continue right now?
- Board is not a second feed.
- Initial cards: Vault Notes, Product Hub, Saved, Profile, Settings, Activity summary.

Install a module:

- Product Hub is the authoritative module catalogue.
- Entry points converge from Drawer, Board, Discover, Composer missing-tool flow, Profile module management, and Settings -> Modules.
- Module install states are explicit and recoverable.

Use the module:

- Vault Notes installs as `digital.modula.vault-notes`.
- Vault Notes is described as `Private in Modula`.
- Owner-only profile tab is optional and disabled by default.
- Save to Vault creates a private Vault Notes record, distinct from Modula social saves.

Manage privacy and appearance:

- Settings groups are product-facing.
- Developer diagnostics are hidden unless explicitly enabled.
- Appearance uses mode, theme, accent, and surface type.
- Accessibility respects system preferences unless the user explicitly overrides a supported option.

Return through notifications:

- Activity supports read state, category filters, and deep links.
- Notification settings separate push, email, and in-app activity.
- Security alerts cannot be disabled completely.

## Explicitly Out Of Scope

- Public developer marketplace
- Paid modules
- DIMON payments
- Full Gaia autonomy
- MMORPG infrastructure
- Unity or Godot runtime
- Enterprise administration
- Federated AT identity
- Complete encrypted messaging
- Public module submission
- Creator monetisation
- Public App Store launch
- Android release, unless separately approved after iOS readiness

## Scope Guard

No Phase 7C work should expand beyond the Alpha loop until the following are testable:

- Greenfield onboarding and session restore
- usable Home feed
- complete social interaction loop
- unified profile
- persistent Board
- integrated Product Hub
- Vault Notes install/use/save-to-vault path
- product-quality Settings and Appearance
- activity/read state
- explicit loading/offline/failure states
- iOS development-build acceptance

Preview, lab, DIMON, Gaia, Gubic, game engine, and marketplace-creator surfaces may remain in Developer or Product Hub disclosure, but they must not confuse the core Alpha path.
