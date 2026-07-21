# Forge Builder — inspiration remap

**Date:** 2026-07-18  
**Sources studied:** Lovable changelog, Bolt.new / Bolt V2 release notes, Base44 features & changelog  
**Rule:** Study craft → reimplement for Modula modules. Do not copy branding, web-app codegen, or fake publish/runtime.

---

## What those builders do well

| Pattern | Lovable | Bolt | Base44 | Modula Forge remap |
| --- | --- | --- | --- | --- |
| Plan before build | Plan Mode | Plan Mode | Discussion mode | **Plan** workspace — outline surfaces/permissions before canvas |
| Conversational build | Chat + Agent Mode | Prompt + agent | Builder chat | **Forge chat** — deterministic Preview replies (not a model) |
| Live preview | App preview | Preview / Code / DB tabs | Instant preview | **Preview pane** — Profile tab / Board card / Settings mock |
| Visual edit | Visual edits | Visual inspector | Canvas tools | Canvas nodes + capability chips |
| Permissions / security | Agent tool access + OAuth | Auth sidebar | Security Scan | **Permissions matrix** + Security Scan Preview |
| Version history | Versions | Version history | Version control | **Local snapshots** of draft manifests |
| Publish confidence | Publish + MCP tools | Publish status | Verification + Testing Agent | **Publish readiness checklist** — no package publish yet |
| Templates / launchpad | Starters | Scaffold first | Launchpad / templates | **Module templates** (Vault Notes, Tasks, CRM, Calendar, Files, Newsletter, Analytics, Health Agent, Game stub, Widget pack, Team inbox, Automations pack) |
| Agents as products | MCP agent integrations | — | Agent Builder | Agents studio + `agent.scope` capability |
| Widget builder | Component blocks | Preview panes | Dashboard widgets | **Widgets mode** — pick Board widgets, AI actions, and event contracts |
| Test/checkout preview | Launch checks | Deploy guardrails | Testing + payments | **Preview matrix + Monetisation Preview** — local-only tests, DIMON checkout disabled |

---

## Honesty boundary

Forge Preview must never claim:

- Live codegen / WebContainer execution
- Registry install success
- Model-backed chat
- Fake security “all clear” that invents CVE results

It **may** show planned pipeline steps and local draft state.

---

## Implementation map

- Workspace modes → `ForgeStudioScreen`
- Permission risk catalogue → `src/features/product/data/modulePermissions.ts`
- Standards + matrix → `/product/module-standards`, `/product/permissions`
- Templates, Widgets mode options, Events, AI actions, Test matrix, Monetisation Preview → `FORGE_TEMPLATES` and related constants in `forgeDraft.ts`
- `skill.md` preview pane → generated markdown string from the local draft; display-only
