# Theme Token Contract

Theme is multidimensional:

- colour mode;
- theme family;
- accent;
- Surface Type;
- text scale;
- accessibility overrides.

Raw palette data lives in `src/theme/data/palettes.json`.
Accent preset data lives in `src/theme/data/accents.json`.

Product code must use semantic token intent:

- `canvas`
- `surface1`
- `surface2`
- `surface3`
- `border`
- `textMain`
- `textSub`
- `textMuted`
- `accent`
- `destructive`
- `warning`
- `success`
- `info`

Product screens must not invent colour tokens or import raw palette JSON.

Mode resolution:

- System + OS light resolves to Light.
- System + OS dark resolves to Dark.
- Light, Dim, Dark and OLED resolve directly.
- System does not resolve to OLED automatically.

Theme-family rule:

Light mode always uses Standard Light colours. The selected family is saved and applies visually in Dim, Dark and OLED.

Accessibility precedence:

Operating-system accessibility requirements override in-app preferences. A user cannot disable a device-level requirement from inside Modula.
