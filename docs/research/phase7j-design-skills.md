# Phase 7J — Design skills research (§7–9)

Date: 2026-08-11

## Discovery (local environment)

Inspected:

- `.cursor/skills/` — `modula-architecture`, `modula-dependencies`, `modula-ui`, `context7-mcp`
- `.cursor/mcp.json` / `.mcp.json` / `docs/engineering/modula-mcp-environment-report.md`
- Cursor user skills under `~/.cursor/skills-cursor/` (canvas, create-skill, sdk, etc. — Cursor product, not Modula UI)

## Modula-owned skills (USE)

| Name | Source | Purpose | Licence | Trust | Decision |
|---|---|---|---|---|---|
| modula-architecture | `.cursor/skills/modula-architecture` | Host vs modules, social contracts, no Bluesky fork | Project | High | **USE** |
| modula-dependencies | `.cursor/skills/modula-dependencies` | Dependency admission / expo install | Project | High | **USE** |
| modula-ui | `.cursor/skills/modula-ui` | Tokens, Surface Types, @expo/ui adapters | Project | High | **USE** |
| context7-mcp | `.cursor/skills/context7-mcp` | Version-accurate third-party docs | Project | High | **USE** |

## External / Cursor skills (USE_FOR_RESEARCH or REJECT)

| Name | Source | Purpose | Decision |
|---|---|---|---|
| canvas | Cursor skills | Analytical canvas UI | **USE_FOR_RESEARCH** (not Modula product UI) |
| create-rule / create-skill | Cursor skills | Agent config authoring | **USE_FOR_RESEARCH** |
| sdk | Cursor skills | Cursor Agent SDK | **NOT_RELEVANT** to Modula product |
| Automate / Autopilot / loop | Cursor skills | Agent orchestration | **NOT_RELEVANT** |

## Desired skill coverage gaps (do not auto-install)

| Topic | Status | Recommendation |
|---|---|---|
| Motion / Reanimated tokens | Gap | Prefer Context7 + installed `react-native-reanimated@4.5.1` docs; encode as Modula `MotionTokens` |
| Native iOS / HIG | Gap | Prefer apple.com HIG; optional Apple Docs MCP only if team-approved |
| Figma design-system sync | Partial | Figma Console MCP read-only; no mass token migration |
| Accessibility | Gap | Follow RN/Expo a11y + existing Modula primitives; no new a11y library without admission |
| SwiftUI samples | Reject wholesale copy | Study patterns; reimplement via `@expo/ui` adapters |

## MCP availability audit (this Mac run)

| MCP | Status | Notes |
|---|---|---|
| cursor-app-control | **AVAILABLE** | Workspace control only in this subagent |
| Context7 | **AUTH_REQUIRED / NOT_IN_SUBAGENT** | Configured in project; not exposed to this subagent catalog |
| Expo MCP | **AUTH_REQUIRED** | Remote OAuth; local `expo-mcp` + `EXPO_UNSTABLE_MCP_SERVER=1` wired in dirty package.json |
| Mobile MCP | **NOT_IN_SUBAGENT** | Prefer Maestro + simctl this run; Simulator booted |
| Metro MCP | **AVAILABLE** (process running) | `metro-mcp` processes observed |
| GitHub MCP | **AUTH_REQUIRED** | Token via env; read-first |
| Figma Console | **AUTH_REQUIRED** | Read-only default |
| Chrome DevTools / Playwright | **NOT_RELEVANT** for native restore gate | Useful later for web |

## Install/use decisions

- **Do not** auto-install speculative design-system skills.
- **Do** follow Modula UI/architecture/dependency skills for all product code.
- **Do** use Context7/Expo MCP from parent agent when library APIs are required.
