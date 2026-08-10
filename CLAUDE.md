# Modula — Claude / coding-agent guidance

This file is the project source of truth for agent behaviour in Modula.
Cursor-specific MCP wiring lives in `.cursor/mcp.json` and `.cursor/rules/`.
Architecture skills live under `.cursor/skills/`. Prefer those skills when
changing app code; this document covers MCP authority, validation, and scope.

## Permanent Modula Agent Rules

### Source of truth

1. **Installed package versions win.** Read `package.json` / lockfile before
   advising. Do not assume Expo SDK, React Native, or library APIs from memory.
2. **Repo docs win for Modula policy.** Architecture, dependency admission, and
   UI primitives are defined under `docs/architecture/` and `.cursor/skills/`.
3. **Upstream docs win for third-party APIs.** Prefer Context7 / Expo MCP over
   training recall when versions or APIs may have changed.

### Expo

1. Use **Expo MCP** (`https://mcp.expo.dev/mcp`) for Expo docs, patterns, and
   EAS guidance. Local capabilities need `expo-mcp` +
   `EXPO_UNSTABLE_MCP_SERVER=1` on start scripts (already wired in `package.json`).
2. Install Expo modules with `pnpm exec expo install` (workspace root may need
   `pnpm add -w` / `-wD` when Expo CLI cannot pass `-w`). Follow
   `.cursor/skills/modula-dependencies/SKILL.md`.
3. Expo MCP remote OAuth may require an Expo account / EAS plan for full tools.
   Do not invent flags when auth is the blocker.

### Context7

1. Use **Context7** for current third-party library docs (React Native,
   Reanimated, React Query, Playwright, etc.).
2. Prefer Context7 over web search for library syntax, config, and migrations.
3. Project rule: `.claude/rules/context7.md` and `.cursor/rules/context7.mdc`.

### Mobile MCP testing

1. Prefer **Mobile MCP** (`@mobilenext/mobile-mcp`) for iOS Simulator /
   Android emulator interaction: list devices, inspect UI, safe navigation,
   screenshots.
2. Keep a Simulator/emulator booted before expecting Mobile MCP success.
3. Do not run destructive device actions (factory reset, erase, revoke
   credentials) unless the user explicitly asks.

### Runtime debug order

When debugging a running Modula app, prefer this order:

1. **Metro MCP** — bundles, errors, Hermes/CDP inspection (no app code changes
   required for core connect).
2. **Expo MCP local capabilities** — when `EXPO_UNSTABLE_MCP_SERVER=1` and
   `expo-mcp` are active.
3. **Mobile MCP** — visual / interaction verification on Simulator.
4. **Chrome DevTools MCP** / **Playwright MCP** — web or browser surfaces.
5. Logs / `xcrun simctl` only when MCP tools are unavailable.

Preserve existing Phase tunnels (e.g. SSH on `4020`) and running Metro unless
the user asks to restart them.

### Design (Figma)

1. Use **Figma Console MCP** (read-only remote is the default project config)
   for design context when a Modula file is connected.
2. If MCP is up but no Modula design file is linked, report:
   `MCP operational / Modula design file not connected`.
3. **Never commit Figma tokens.** Prefer OAuth / local env /
   `.cursor/mcp.local.json` (gitignored).
4. **Design-token sync (future guidance only):** when Modula maintains a
   Figma → token pipeline, agents may *propose* token diffs. Do **not** run
   mass token migrations or redesign the design system unless a dedicated
   phase explicitly requests it.

### iOS / Apple

1. Prefer Apple Human Interface Guidelines and apple.com developer docs for
   platform UX. An Apple Docs / HIG MCP is **optional** — only enable a
   well-maintained server if the team adopts one; do not invent APIs.
2. Respect existing Modula UI adapters (`@expo/ui`, theme tokens) rather than
   copying SwiftUI samples wholesale.

### Browser

1. **Chrome DevTools MCP** for live Chrome debugging / performance.
2. **Playwright MCP** for scripted browser checks against Modula web or safe
   local pages.
3. Do not mass-approve destructive browser permissions.

### GitHub

1. Use **GitHub MCP** read-first (`X-MCP-Readonly` when supported) for repo
   metadata, PRs, and issues.
2. **Never commit PATs / tokens.** Cursor uses
   `${env:GITHUB_PERSONAL_ACCESS_TOKEN}`. Claude Code may store auth in
   user-local config (`~/.claude.json`), never in committed `.mcp.json`.
3. Prefer read-only operations unless the user asks for a write (PR create,
   comment, etc.).

### Validation

1. Prefer MCP + Simulator evidence over claims based on exit code alone.
2. Run `pnpm typecheck` and `pnpm lint` when scripts exist and the change
   warrants them.
3. Preserve uncommitted work. Do not `git reset`, force-checkout, or discard
   Phase evidence unless the user explicitly requests it.

### Scope

1. This MCP environment work is **not** product feature development.
2. Do not redesign Modula, speculative-refactor, or expand dependency surface
   “just in case.”
3. Application code changes only when a verified MCP integration requires them
   (e.g. `expo-mcp`, start-script env). Prefer docs/config/rules.

## Claude Code vs Cursor

| Surface | Claude Code | Cursor |
| --- | --- | --- |
| Shareable servers | `.mcp.json` (project scope) | `.cursor/mcp.json` |
| Local / secrets | `~/.claude.json` project local | env vars / gitignored `mcp.local.json` |
| CLI | `claude mcp add/list` | Cursor Settings → MCP / project JSON |
| Greenfield helper | optional | `modula-greenfield` via `pnpm` filter |

Both configs should stay aligned for: Expo, Mobile MCP, Metro MCP, Figma
Console (read-only), Context7, GitHub (read-first), Chrome DevTools, Playwright.

## Quick start

```bash
# Claude
claude mcp list

# Expo local capabilities (package already installed as expo-mcp)
pnpm start   # EXPO_UNSTABLE_MCP_SERVER=1 is prefixed in scripts

# Context7 CLI smoke (optional)
npx ctx7 library react-native-reanimated "shared values"

# GitHub env for Cursor MCP
export GITHUB_PERSONAL_ACCESS_TOKEN="$(gh auth token)"
```

## Pointers

- `docs/engineering/modula-mcp-environment-report.md`
- `docs/architecture/greenfield-mcp.md`
- `.cursor/skills/modula-architecture/SKILL.md`
- `.cursor/skills/modula-dependencies/SKILL.md`
- `.cursor/skills/modula-ui/SKILL.md`
