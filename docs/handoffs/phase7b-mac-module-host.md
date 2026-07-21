# Phase 7B Mac Module Host Handoff

## Backend Source

- Branch: `phase7a-greenfield-module-platform`
- Starting commit: `ba84de37eb66d98f878db06f3560b8bb9501045b`
- Backend commit: PR head commit for Phase 7A; record the exact SHA from the final Phase 7A report.
- Greenfield API: `https://api.modula.digital`
- Database migration: `009_phase7a_module_platform.sql`
- Worker deployment: `greenfield-worker` with module lifecycle jobs enabled.

## API Surfaces

- Registry: `GET /v1/registry/modules`, `GET /v1/registry/modules/:moduleId`, `GET /v1/registry/modules/:moduleId/versions`, `GET /v1/registry/modules/:moduleId/versions/:version`, `GET /v1/registry/publishers/:publisherId`
- Installation: `GET /v1/modules/installed`, `GET /v1/modules/installed/:moduleId`, `POST /v1/modules/:moduleId/install-preview`, `POST /v1/modules/:moduleId/install`, `POST /v1/modules/:moduleId/enable`, `POST /v1/modules/:moduleId/disable`, `POST /v1/modules/:moduleId/update`, `POST /v1/modules/:moduleId/uninstall-preview`, `DELETE /v1/modules/:moduleId/install`
- Settings: `GET /v1/modules/:moduleId/settings-schema`, `GET /v1/modules/:moduleId/settings`, `PATCH /v1/modules/:moduleId/settings`
- Contributions: `GET /v1/modules/contributions`
- Tools/functions: `GET /v1/tools`, `GET /v1/functions`

## Reference Module

- Module ID: `digital.modula.vault-notes`
- Version: `0.1.0`
- Repository: `modula-mod/modula-module-vault-notes`
- Product state: Foundation / Preview
- Execution: declarative; function contracts are registered with executable handlers disabled.
- Default visibility: private.
- Native dependencies: none expected.

## Required Mac Surfaces

- Board module cards.
- Settings -> Modules.
- Module catalogue.
- Module details.
- Install-preview permission sheet.
- Enable/disable control.
- Module settings renderer from settings schema/defaults.
- Composer tool registration.
- Profile-tab registration.
- Module route host.
- Vault Notes preview surface.

## Boundaries

- Do not implement Vault Notes as host-native screens in Phase 7B; render module-host surfaces against registry/contribution APIs.
- Do not execute GitHub source code.
- Do not activate DIMON.
- Do not require AT Protocol.
- Treat `remoteHttp` functions as disabled unless the backend feature flag changes.
