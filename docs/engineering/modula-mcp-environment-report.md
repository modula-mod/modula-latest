# Modula MCP Environment Report

Generated: 2026-08-10 (Mac agent mission)

```
MODULA MCP ENVIRONMENT REPORT
Repository: /Users/msjoy/Developer/modula-latest (modula-mod/modula-latest)
Branch: phase7i-mac-native-ui-acceptance
Commit: 3fe0486 docs: record Mac-B final SHA and build success
Expo SDK: ~57.0.11 (CLI npx expo --version 57.0.13)
React Native: 0.86.2
Expo Router: ~57.0.11
MCP STATUS
Expo: FAIL
Mobile MCP: PASS
Metro MCP: PASS
Figma Console: PENDING DESIGN FILE
Context7: PASS
GitHub: PASS
Chrome DevTools: PASS
Playwright: PASS
Apple Docs: OPTIONAL
CLAUDE.md: Created at repo root; Cursor mirror rule at `.cursor/rules/modula-mcp.mdc`; Context7 rules/skills installed for Claude + Cursor
Secrets: No PATs/tokens in committed files. GitHub PAT kept only in user-local `~/.claude.json` (Claude Code 2.0.36 remote MCP requires Authorization header). Cursor GitHub MCP uses `${env:GITHUB_PERSONAL_ACCESS_TOKEN}`. Local helper: `.artifacts/mcp/refresh-claude-github-mcp.sh` (under gitignored `.artifacts/`). A PAT briefly appeared in agent terminal output during setup — rotate the `gh` token if this log is retained. Figma/Context7 use OAuth endpoints (no tokens in git).
Simulator: iPhone 17 Pro (0727E2F0-8528-44DA-9F4C-7B5F7394096B) iOS 27.0 booted. Mobile MCP listed device, inspected on-screen elements, opened `modula://discover` then `modula://` after setting `MOBILEMCP_ALLOW_UNSAFE_URLS=1`.
Runtime: Metro listening on :8081 (`packager-status:running`, Hermes app `digital.modula.app`). SSH tunnel on :4020 preserved. metro-mcp connected; `get_bundle_errors` → "No bundle errors detected." Start scripts prefix `EXPO_UNSTABLE_MCP_SERVER=1`. `expo-mcp@~0.2.4` installed as workspace root devDependency.
Web: Playwright MCP navigated https://example.com and returned accessibility snapshot. Chrome DevTools MCP headless navigated to the same page successfully.
Validation: `pnpm typecheck` PASS (exit 0). `pnpm lint` PASS (exit 0). Phase 7I-MAC-B evidence directories retained. Parallel commits landed Phase 7I app changes onto this branch while MCP setup ran; uncommitted Phase 7I edits were not discarded by this mission.
Files changed:
- CLAUDE.md (new)
- .mcp.json (new — Claude project MCP servers)
- .cursor/mcp.json (new — Cursor project MCP servers)
- .cursor/mcp.json.example (updated)
- .cursor/rules/modula-mcp.mdc (new)
- .cursor/rules/context7.mdc (from ctx7 setup)
- .cursor/skills/context7-mcp/ (from ctx7 setup)
- .claude/rules/context7.md + .claude/skills/context7-mcp/ (from ctx7 setup)
- package.json (expo-mcp; EXPO_UNSTABLE_MCP_SERVER on start scripts)
- pnpm-lock.yaml
- docs/architecture/dependency-register.md (expo-mcp row)
- .gitignore (MCP local secret overlays + .playwright-mcp/)
- docs/engineering/modula-mcp-environment-report.md (this file)
Problems discovered:
- `pnpm exec expo install expo-mcp --dev` fails on this pnpm workspace without `-w`; used `pnpm add -wD expo-mcp@~0.2.1` (resolved ~0.2.4).
- Claude Code is 2.0.36 (pre-2.1.1): GitHub remote MCP needs legacy Authorization header; `claude mcp list` shows local-scope servers (project `.mcp.json` also present for sharing).
- Expo remote MCP returns Needs authentication / HTTP 403 without Expo OAuth / account login (`npx expo whoami` → Not logged in). EAS paid plan may be required for full Expo MCP per upstream docs.
- Context7 project MCP URL is OAuth (`/mcp/oauth`) — needs IDE/Claude auth handshake before tools are live in-session.
- Figma Console MCP is up (104 tools via mcp-remote SSE bridge) but `figma_get_status` shows browser not running / not initialized; no Modula design file connected.
- Mobile MCP blocks custom URL schemes unless `MOBILEMCP_ALLOW_UNSAFE_URLS=1` (now set in project MCP configs).
- Cursor `GetMcpTools` did not yet enumerate newly added project MCP servers in this agent session (reload Cursor MCP / restart needed).
- Docker Desktop not running — GitHub Docker/OAuth local alternative unavailable.
Problems fixed:
- Registered Tier A/B MCP servers for Claude (project `.mcp.json` + local mirrors) and Cursor (`.cursor/mcp.json`).
- Installed `expo-mcp` and wired `EXPO_UNSTABLE_MCP_SERVER=1` onto existing start/web scripts without removing prior flags.
- Context7 MCP + rules/skills for Claude and Cursor via `npx ctx7 setup --claude --cursor --mcp --project --oauth --yes`.
- Figma Console read-only remote via `mcp-remote` (upstream Claude SSE bug workaround).
- GitHub MCP read-first with `X-MCP-Readonly: true`; no tokens in repo files; scrubbed accidental PAT echo from config after setup.
- Enabled Modula deep links for Mobile MCP; verified list/inspect/nav.
- Documented agent MCP authority in `CLAUDE.md` + Cursor rule; updated dependency register; gitignored secret overlays and Playwright MCP snapshots.
Remaining blockers:
- Complete Expo MCP OAuth (`npx expo login` / Claude `/mcp` Authenticate) — and confirm EAS plan entitlement for hosted Expo MCP.
- Complete Context7 OAuth in Claude Code and Cursor so MCP tools (not only `ctx7` CLI) authenticate in-session.
- Connect Modula Figma design file / Desktop Bridge for design-system workflows (optional full NPX mode with local token outside git).
- Reload Cursor so project `.cursor/mcp.json` servers become available to the Agent MCP tool bridge; set `GITHUB_PERSONAL_ACCESS_TOKEN` in the environment Cursor launches with (or `launchctl setenv`).
- Optional: upgrade Claude Code ≥ 2.1.1 for newer `mcp add-json` GitHub flows; optional Apple Docs/HIG MCP only if team adopts a maintained server.
Recommended next engineering phase:
- Resume Phase 7I Mac native UI acceptance / founder validation using Mobile MCP + Metro MCP as the default runtime debug path; defer design-token sync until a Modula Figma file is connected. Treat Expo MCP as docs/auth follow-up, not a product blocker.
```

## Claude Code vs Cursor

| Item | Claude Code | Cursor |
| --- | --- | --- |
| Shareable config | `.mcp.json` | `.cursor/mcp.json` |
| Secrets | User-local `~/.claude.json` only | `${env:...}` / gitignored `mcp.local.json` |
| Registration CLI | `claude mcp add/list` (present v2.0.36) | Project JSON + Settings → MCP |
| Greenfield helper | Optional | `modula-greenfield` included in Cursor config |

## Upstream differences noted

- Expo: official URL `https://mcp.expo.dev/mcp`; local package `expo-mcp` + `EXPO_UNSTABLE_MCP_SERVER=1`.
- Mobile MCP: `claude mcp add mobile-mcp -- npx -y @mobilenext/mobile-mcp@latest`; Modula needs `MOBILEMCP_ALLOW_UNSAFE_URLS=1` for `modula://`.
- Metro MCP: `npx -y metro-mcp` (no app code changes); optional `--port` for non-default Metro.
- GitHub: remote `https://api.githubcopilot.com/mcp/`; Claude 2.0.36 uses legacy header auth; prefer read-only header.
- Figma Console: use `mcp-remote` for Claude Code instead of native `--transport sse`.
- Chrome DevTools: upstream example uses `--scope user`; this mission used project scope + `--no-usage-statistics`.
- Playwright: `npx @playwright/mcp@latest` as documented.
- Apple Docs/HIG MCP: community options exist; left **OPTIONAL** — use apple.com docs unless adopted.

## Design-token sync (future only)

When a Modula Figma file is connected, agents may propose token diffs via Figma Console MCP. Do **not** mass-migrate tokens or redesign the system unless a dedicated phase requests it.
