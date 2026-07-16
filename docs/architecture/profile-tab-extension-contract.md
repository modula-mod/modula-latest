# Profile Tab Extension Contract

Future module tab contribution:

```ts
export type ModuleProfileTabContribution = {
  moduleId: string
  manifest: ProfileTabManifest
  rendererKey: string
  requiredPermissions: string[]
}
```

Rules:

1. Modules provide serialisable manifests.
2. The host controls renderer registration.
3. Modules cannot mutate core tabs.
4. Modules cannot disable Posts.
5. Modules respect profile visibility.
6. Module failure stays inside a feature error boundary.
7. The profile remains usable if the module is unavailable.
8. Uninstalled modules remove their profile-tab contribution.
9. The main profile screen does not hardcode module-specific tabs.
10. Remote dynamic code is not implemented in Phase 3.
