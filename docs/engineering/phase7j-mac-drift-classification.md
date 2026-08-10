# Phase 7J — Mac worktree drift classification

Date: 2026-08-11  
Branch at classification: `phase7i-mac-native-ui-acceptance` @ `3fe0486`  
Convergence branch: `phase7j-product-convergence` (created from that checkpoint)

## Classification legend

| Class | Meaning |
|---|---|
| REQUIRED_ENGINEERING_ENV | Needed for agent/MCP/dev environment; safe to land on engineering docs track |
| REQUIRED_PRODUCT | Required for product/session behaviour |
| VALID_BUT_SEPARATE | Legitimate but should not mix into product commits blindly |
| ACCIDENTAL | Should not be committed |
| UNKNOWN | Must be resolved before commit |

## Dirty paths (pre-7J working tree)

| Path | Class | Notes |
|---|---|---|
| `package.json` (expo-mcp + `EXPO_UNSTABLE_MCP_SERVER=1` start scripts) | VALID_BUT_SEPARATE | MCP environment wiring; not product. Admit via dependency-register row already present. Land in a dedicated engineering commit, not with product UI. |
| `pnpm-lock.yaml` (expo-mcp + transitive MCP SDK) | VALID_BUT_SEPARATE | Lockfile pair for expo-mcp. Keep with package.json engineering commit. |
| `docs/architecture/dependency-register.md` (+ expo-mcp row) | REQUIRED_ENGINEERING_ENV | Matches dependency admission skill. |
| `.gitignore` (mcp local secrets / playwright snapshots) | REQUIRED_ENGINEERING_ENV | Prevents token leaks. |
| `.cursor/mcp.json.example` | REQUIRED_ENGINEERING_ENV | Shareable MCP example; no secrets. |
| `.cursor/mcp.json` | VALID_BUT_SEPARATE | Local Cursor MCP config; may contain env refs — review before commit; prefer example + gitignore for secrets. |
| `.mcp.json` | VALID_BUT_SEPARATE | Claude Code MCP mirror; align with Cursor example; no PATs. |
| `CLAUDE.md` | REQUIRED_ENGINEERING_ENV | Project agent authority doc. |
| `.cursor/rules/context7.mdc` | REQUIRED_ENGINEERING_ENV | Context7 rule. |
| `.cursor/rules/modula-mcp.mdc` | REQUIRED_ENGINEERING_ENV | MCP authority rule. |
| `.cursor/skills/context7-mcp/SKILL.md` | REQUIRED_ENGINEERING_ENV | Context7 skill. |
| `.claude/rules/context7.md` | REQUIRED_ENGINEERING_ENV | Claude mirror of Context7 rule. |
| `.claude/skills/context7-mcp/SKILL.md` | REQUIRED_ENGINEERING_ENV | Claude mirror of Context7 skill. |
| `docs/engineering/modula-mcp-environment-report.md` | REQUIRED_ENGINEERING_ENV | MCP environment evidence. |

## Product / session fixes introduced on `phase7j-product-convergence`

| Path | Class | Notes |
|---|---|---|
| `src/auth/runtime/SessionProvider.tsx` | REQUIRED_PRODUCT | Session restore gate — do not skip SecureStore when `DEMO_SESSION` defaults to signedOut; single-flight bootstrap. |
| `src/auth/runtime/SessionBootstrap.ts` | REQUIRED_PRODUCT | Bootstrap timeout 25s. |
| `src/auth/runtime/SessionRefreshCoordinator.ts` | REQUIRED_PRODUCT | Single-flight refresh; avoid Strict Mode vault wipe. |
| `src/auth/storage/NativeSecureSessionStorage.ts` | REQUIRED_PRODUCT | Read-after-write + accessibility fallbacks. |
| `src/config/runtimeEnvironment.ts` | REQUIRED_PRODUCT | Clarify demoSession default semantics. |

## Resolved UNKNOWN

No UNKNOWN paths remain. Initial conversation snapshot listed product files that were already committed at `2791ba0` / `77156e3` before this classification; they are not dirty at HEAD `3fe0486`.

## Commit policy for 7J

1. Product session-restore fix → first commit on `phase7j-product-convergence`.
2. Engineering MCP env (package + rules + docs) → separate commit; do not conflate with product DoD.
3. Never commit `.artifacts/**/test-account.local.env` or tokens.
