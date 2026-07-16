# Profile Feature

Phase 3 profile code lives in this feature folder.

Routes remain thin under `src/app`. The reusable owner/public/preview architecture is `screens/UnifiedProfileScreen.tsx` -> `components/ProfileShell.tsx`.

Only presentation preferences are persisted. Personal profile edits, avatar and cover selections are session-local in Phase 3.
