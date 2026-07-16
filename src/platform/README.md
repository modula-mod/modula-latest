# Platform

Platform-specific helpers for iOS, Android, and web.

Prefer shared React Native code first. Place thin platform forks here only when behaviour genuinely diverges.

Shared Modula UI adapters live in `src/platform/ui/` (keyboard, camera presentation, menus). Product screens import those wrappers — not `@expo/ui/swift-ui`.
