# Profile Visibility Model

Phase 3 supports these presentation visibility values:

- Public
- Followers
- Teams
- Private

The central helper is `canViewerSeeProfileField` in `src/features/profile/contracts/profile.ts`.

Important: hiding a field in the interface does not constitute secure backend access control. Production visibility must be enforced by backend APIs and storage policies.

In Phase 3, visibility is a local presentation simulation only.
