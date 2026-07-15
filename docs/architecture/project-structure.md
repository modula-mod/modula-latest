# Project Structure

```text
src/
├── app/                 # Expo Router routes only
├── components/
│   ├── primitives/      # Shared UI primitives
│   └── system/          # System-level UI helpers
├── features/            # Product vertical slices
├── shell/               # Application chrome (deferred)
├── modules/             # Module host / contracts (docs only in Phase 0)
├── services/            # api / storage adapters
├── social/              # Social contracts and adapters
├── theme/               # Foundations, tokens, runtime
├── platform/            # iOS / Android / web forks
├── lib/                 # Small shared utilities
└── types/               # Shared TypeScript types
```

## Rules

- Keep routes thin; put reusable UI in `components` or `features`.
- Do not create a second root-level `app` directory. Routing lives in `src/app`.
- Path alias `@/*` maps to `src/*`.
- Native projects live at repository root (`ios/`, `android/`) after prebuild and are first-class source.
