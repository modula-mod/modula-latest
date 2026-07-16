# Phase 3 Unified Profile

Starting branch: `phase2-appearance-runtime`

Starting commit: `2d47277e590f9690824032e2e75f3ec3737cfae8`

Phase 3 branch: `phase3-unified-profile`

## Objective

Phase 3 makes Profile the central Modula social, identity and modular surface. The owner profile, public profiles and visitor preview all render through `UnifiedProfileScreen` and `ProfileShell`.

Identity is inside Profile. No Identity Centre route is introduced.

## Runtime Boundary

The profile runtime is local-only:

- no authentication;
- no backend profile storage;
- no production API client;
- no remote image upload;
- no remote module installation;
- no cryptographic identity.

`ProfileProvider` starts with synchronous demo data and hydrates only presentation preferences from `AsyncStorage` key `modula.profile.presentation.v1`. Storage failure falls back to defaults and does not block app startup.

## Architecture

Core pieces:

- contracts: `src/features/profile/contracts/*`
- repository boundary: `src/features/profile/repository/*`
- runtime provider: `src/features/profile/runtime/ProfileProvider.tsx`
- tab registry: `src/features/profile/registry/*`
- reusable shell: `src/features/profile/components/ProfileShell.tsx`
- screens: `src/features/profile/screens/*`
- core tabs: `src/features/profile/tabs/*`

The repository boundary is ready for a future backend adapter, but Phase 3 uses `DemoProfileRepository` and local provider state only.

## Demo Identity

Identity claims use explicit statuses:

- Self-declared
- Connected
- Verified

Verified claims in demo data are visual demonstrations only. They are not cryptographic verification or production trust issuance.

## Acceptance Note

Phase 3 code can be validated locally because it adds no native dependency. It must not be declared fully complete until the existing Phase 2/3 development client is built and tested on a physical iPhone.
