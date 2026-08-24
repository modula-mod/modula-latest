# PVP Platform Phase 2 capability broker

## Separation of authority

Three independent facts are required:

1. The target exposes an extension point that accepts the contribution kind.
2. The extension release declares the contribution/action/function.
3. The account has granted every required data/execution capability.

Therefore permission to render “Summarise” does not itself grant `notes.read`.

## Grant model

`greenfield_extension_capability_grants` binds:

- account;
- consumer product/installation;
- target product/installation;
- typed capability;
- installation/action/resource scope;
- requested, granted, denied, revoked, or reauthorisation-required state;
- approving account and timestamps.

The unique key includes the nullable scope using `UNIQUE NULLS NOT DISTINCT`,
so repeated reviews update one authoritative grant instead of creating
ambiguous duplicates.

## Invocation algorithm

For each contribution invocation Greenfield checks:

1. authenticated account;
2. enabled consumer projection and enabled registration;
3. exact target and declared contribution ID;
4. exact declared action/function contract;
5. point, contribution, and availability capabilities;
6. active grant to the resolved target installation;
7. target resource ownership and non-deleted state;
8. service registration/network policy when backend execution is required.

Any missing capability is `FORBIDDEN`. A resource owned by another account is
returned as `NOT_FOUND` to avoid disclosing its existence.

## Vault Notes capability surface

The reference module exposes typed contracts including `notes.read`,
`notes.create`, `notes.update`, `notes.delete`, `notes.search`, collection and
attachment capabilities, `notes.export`, `notes.editor.contribute`,
`notes.actions.contribute`, and `notes.events.subscribe`.

Vault AI requests note read/search and contribution capabilities but not delete
or export. Vault Voice requests capture/playback/transcription and only the note
operations needed to attach or insert a user-approved transcript. The formatting
plugin has contribution permission only and no network or broad record access.

## Reauthorisation

An update that asks for a capability outside the last approved set remains
denied/`requires-reauthorisation`. Install or update cannot silently expand a
grant.
