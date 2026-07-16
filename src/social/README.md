# Social

Social protocol access is isolated behind contracts and adapters.

UI components must depend on `SocialProvider` contracts, never on a specific protocol client.

## Phase 1

`DevelopmentSocialProvider` serves in-memory mock posts/profiles. Feed and Explore use it only — no network required for first frame.

Future adapters (AT Protocol, Modula-native) plug in behind the same contract without rewriting UI.
