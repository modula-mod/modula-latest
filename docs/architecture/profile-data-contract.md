# Profile Data Contract

Profile UI consumes `ModulaProfile`, not backend account models.

Key contracts live in:

- `src/features/profile/contracts/profile.ts`
- `src/features/profile/contracts/identity.ts`
- `src/features/profile/contracts/presence.ts`
- `src/features/profile/contracts/profileTabs.ts`

`ProfileViewerContext` is resolved once by `ProfileShell`. Child components receive permissions and must not infer owner controls by comparing handles.

Profile presentation preferences are the only persisted profile data in Phase 3. Avatar, cover and personal identity edits are local session state.

Future backend work should implement `ProfileRepository` without changing profile UI components.
