# Social

Social protocol access is isolated behind contracts and adapters.

UI components must depend on `SocialProvider` contracts, never on a specific protocol client. Adapters (AT Protocol, Modula-native, development fakes) are added in later phases.
