# Phase 2 Hardcoded Style Audit

Baseline commands:

- `cat package.json`
- `cat app.config.ts`
- `cat eas.json`
- `cat tsconfig.json`
- `find src/theme -maxdepth 5 -type f | sort`
- `find src/components -maxdepth 4 -type f | sort`
- `find src/features -maxdepth 5 -type f | sort`
- `find src/app -maxdepth 4 -type f | sort`
- `pnpm exec expo config --type public`
- `pnpm exec expo install --check`
- `pnpm exec expo-doctor`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm verify:phase1`

Initial findings:

- Existing runtime was `src/theme/runtime/ThemeProvider.tsx`, `resolveTheme.ts`, `useTheme.ts`, and `useThemeTokens.ts`.
- Direct Ionicons import was centralized in `src/components/primitives/AppIcon.tsx`.
- Product screens used legacy semantic names including `surface`, `surfaceRaised`, `surfaceMuted`, `text`, `textSecondary`, and `textTertiary`.
- `src/shell/ComposerFab.tsx` had direct shadow and elevation styles.
- `src/features/reels/screens/ReelsScreen.tsx` and `src/features/discover/screens/DiscoverScreen.tsx` had local scrim colour literals.
- Settings existed as a single route file at `src/app/settings.tsx`.
- Root provider order placed `DemoSocialProvider` and `ShellDrawerProvider` above the Phase 1 theme runtime.

Migration result:

- The old runtime entrypoints now forward to `AppearanceProvider`.
- Material components own blur, native glass, shadow and elevation.
- Phase 2 verifier rejects restricted colour, blur, glass, shadow and AsyncStorage imports outside approved layers.
