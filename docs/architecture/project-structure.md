# Project Structure

```text
src/
├── app/                 # Expo Router routes only
│   ├── (tabs)/          # Board, Feed, Explore, Notifications, Profile
│   ├── settings/        # Settings tree (Account, Privacy, Moderation, …)
│   ├── compose.tsx
│   ├── coming-soon.tsx
│   └── dev/components.tsx
├── components/
│   ├── primitives/      # App* shared UI
│   └── system/          # @expo/ui adapters (no swift-ui in features)
├── features/            # Feed, profile slices
├── shell/               # FAB, headers
├── modules/             # Host contracts (docs/placeholders)
├── services/
├── social/              # SocialProvider + DevelopmentSocialProvider
├── theme/               # Foundations, tokens, runtime
├── platform/
│   └── ui/dev/expo-ui-lab/  # Developer Expo UI playground (swift-ui OK here)
├── lib/
└── types/
```

## Rules

- Keep routes thin; put reusable UI in `components` or `features`.
- Routing lives only in `src/app`.
- Path alias `@/*` → `src/*`.
- Native projects at repo root (`ios/`, `android/`) are first-class after prebuild.
