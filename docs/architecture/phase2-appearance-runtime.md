# Phase 2 Appearance Runtime

Starting commit: `61a2583`
Branch: `phase2-appearance-runtime`
Date: 2026-07-16

Phase 2 replaces the Phase 1 theme helper with one typed appearance runtime rooted at `AppearanceProvider`.

Provider order:

```tsx
<AppErrorBoundary>
  <AppearanceProvider>
    <DemoSocialProvider>
      <ShellDrawerProvider>
        <RootNavigator />
      </ShellDrawerProvider>
    </DemoSocialProvider>
  </AppearanceProvider>
</AppErrorBoundary>
```

Runtime entrypoints:

- `src/theme/runtime/resolveAppearance.ts`
- `src/theme/runtime/AppearanceProvider.tsx`
- `src/theme/runtime/useAppearance.ts`
- `src/theme/runtime/useAppearanceActions.ts`
- `src/theme/runtime/useThemeTokens.ts`

The resolved result is immutable for consumers. Screens must consume resolved tokens and must not independently decide dark mode, material type, accent contrast, or accessibility overrides.

Persistence:

- Key: `modula.appearance.preferences.v1`
- Schema version: `1`
- Storage: AsyncStorage
- Scope: non-sensitive appearance preferences only

Physical-device baseline:

The Phase 1 physical-iPhone baseline was not executed in this session because the agent cannot operate the installed development client on the iPhone. The blocker is recorded in `docs/validation/phase1-device-baseline.md`.
