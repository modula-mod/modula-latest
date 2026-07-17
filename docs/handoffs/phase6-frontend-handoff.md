# Phase 6 frontend handoff (Mac)

The VPS Phase 6 backend branch did **not** modify `src/`, `ios/`, `android/`, or `assets/`.

Mac must implement on `phase6-atproto-frontend` branched from `phase6-atproto-backend`:

1. Connected Accounts settings (`/settings/connections`, `/settings/connections/atproto`)
2. Official `@atproto/oauth-client-expo` + native redirect `modula://oauth/atproto`
3. Public-data warning + progressive publishing permission UI
4. Composer destination selector (default Modula only; never for private posts)
5. AT publication status surfaces
6. Atmosphere Preview on Discover with origin labels
7. Profile About connected-identity line
8. Capability-gated controls from `/v1/meta`
9. Phase 6 frontend verifier + native/iPhone acceptance

See also: `docs/handoffs/phase6-atproto-frontend.md`
