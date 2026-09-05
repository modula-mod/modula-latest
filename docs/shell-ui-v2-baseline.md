# Shell UI V2 failure baseline

## Provenance

- `SHELL_UI_V2_START_MAIN_SHA`: `85cf6566ef3251503f71b311fa508c4ab0bf9b79`
- Source: freshly fetched `origin/main` from `modula-mod/modula-latest`
- Reference: supplied Vault Notes standalone-PWA screenshot and the accepted
  Shell UI V1 evidence under `docs/validation/evidence/shell-ui-v1/`
- Verdict: **FAIL**. The current module screen is not visually acceptable.

## Observed failures

The reference screen gives the back control and Share/More chrome too much
visual weight. The product identity is weakened by the generic **Module** title,
while the extension action is promoted into an oversized content-level button.
The actual product hierarchy is consequently harder to scan than the shell
chrome around it.

The create-note experience is overly cardified: rounded page containers,
field containers, and action containers are nested where typography, spacing,
and separators should establish hierarchy. Inputs and actions are visibly too
tall, radii and padding are excessive, sections occupy too much vertical space,
and the primary save/create action is detached from the editor flow. The result
has low content density despite containing little product content.

The screen also exposes engineering helper copy about rich-text storage and
plain-text projection. That language belongs in developer documentation or
diagnostics, not the consumer editor. Folder and tags render as generic text
inputs rather than product-appropriate selection/token controls, subject to the
real backend contract.

The baseline defects are therefore:

- oversized navigation controls;
- a generic `Module` title and weak Vault Notes identity;
- an oversized extension action;
- weak title, section, field-label, helper, and action hierarchy;
- nested cards and excessive cardification;
- oversized single-line inputs and normal actions;
- oversized radii, page padding, section gaps, and section height;
- consumer-facing engineering helper copy;
- poor primary-action placement;
- insufficient content density;
- accidental inner scrolling/visible inner scroll indicator risk caused by
  fixed or independently scrolling content regions.

## Ownership classification

| Failure | Owner |
| --- | --- |
| Semantic control size, typography, radius, spacing, fields, rows | Host/shared UI |
| Back and grouped Share/More chrome | Generic Module Host |
| Product title resolved from active release presentation metadata | Generic Module Host |
| Extension-point presentation | Generic Module Host |
| Vault Notes list/editor composition | Vault Notes product repository |
| Product Hub and module detail | Shell |

No product-name or product-ID branch may be added to the host. Any Vault
Notes-specific composition change requires a new immutable Vault Notes release;
release `1.6.0` must not be modified in place.
