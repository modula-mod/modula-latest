# Phase 7M-B7 production web deployment

## Release identity

| Field | Value |
| --- | --- |
| Source ref | `origin/cursor/phase7m-b7-full-route-post-v2` |
| Web source SHA | `f0da1c1d707f262687ee35284d2721c98f32e2e5` |
| Previous web release | `19f34fca358c3b5a51ced38b5a297c7ff5089c4e` |
| Current web release | `f0da1c1d707f262687ee35284d2721c98f32e2e5` |
| API running SHA | `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a` |
| Worker running SHA | `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a` |
| Rollout | Intentional web-only |
| Database migration | None |

The web artifact was built from the pushed commit in the detached worktree
`/root/modula-builds/f0da1c1d707f262687ee35284d2721c98f32e2e5` and copied to
`/var/www/modula/releases/f0da1c1d707f262687ee35284d2721c98f32e2e5`.
The release contains 203 files; a SHA-256 comparison against the tested `dist`
tree produced no differences.

`/var/www/modula/current` was switched atomically. No production source, built
JavaScript, HTML, API container, worker container, or database state was edited
in place. Nginx configuration did not change during the final cutover, so it was
not reloaded; `nginx -t` still passed.

## Source resolution

| Field | SHA / ref |
| --- | --- |
| Initial VPS checkout HEAD | `e5d4b946fdf80fb82f0ae0963bdd3a087ff5e97a` |
| `origin/main` | `fcca100137526ff44892ba1b2870238d11b78834` |
| Initial latest pushed UI candidate | `origin/cursor/full-route-screenshots-99cd` at `d81d2c9` |
| Final target ref | `origin/cursor/phase7m-b7-full-route-post-v2` |
| Final target SHA | `f0da1c1d707f262687ee35284d2721c98f32e2e5` |

The required `ssh modula-vps` alias did not resolve in this host environment.
The work was already running directly on `core.modula.digital`; no IP address
was substituted in source, scripts, or documentation.

## Verification

| Gate | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm typecheck` | PASS |
| `pnpm lint` | PASS |
| `CI=true pnpm verify:phase7m-b7` | PASS |
| `pnpm verify:vault-notes-canonical` | PASS |
| `pnpm verify:phase7m-b6` | PASS |
| `pnpm build:web` | PASS |
| `pnpm verify:web-build` | PASS; exact SHA, 203 files |
| `CI=true pnpm exec expo install --check` | PASS |
| `CI=true pnpm exec expo-doctor` | 19/20; existing native/CNG sync warning |
| `git diff --check` | PASS |
| Exact-artifact Playwright | 26 PASS, 0 FAIL, 1 controlled local mutation SKIP |
| Public Playwright | 26 PASS, 0 FAIL, 1 controlled local mutation SKIP |
| Production route capture | 173 PASS, 0 REVIEW |
| Post state capture | 9 PASS, 0 REVIEW |
| Unexpected critical events | 0 |
| Unexpected HTTP failures | 0 |

The aggregate `pnpm verify:phase7m-b` source and dynamic checks pass, but its DB
test environment is unavailable and its test routine performs migration down/up.
It was not run against production because B7 explicitly prohibits migrations.

## Rollback

The preserved rollback target is
`/var/www/modula/releases/19f34fca358c3b5a51ced38b5a297c7ff5089c4e`.
The exact rollback operation is:

```sh
ln -sfn /var/www/modula/releases/19f34fca358c3b5a51ced38b5a297c7ff5089c4e /var/www/modula/current.phase7m-b7-rollback
mv -Tf /var/www/modula/current.phase7m-b7-rollback /var/www/modula/current
```

## Open P2/P3 items

- P2: Expo Doctor reports the existing checked-in native-project/CNG config sync warning.
- P2: the canonical backend has no persisted audio post kind, so production music/full-player evidence is not exposed and was not fabricated.
- P2: production has no controlled public video post fixture, so video/full-player production evidence remains open.
- P2: authenticated installed-state and guest reaction persistence require a controlled production evidence account; no private credentials were used.
- P3: founder visual review remains required.

P0 open: 0. P1 open: 0. Phase 7M-C was not started.
