# Auth Capability Model

Capabilities are defined in `src/auth/contracts/AuthCapability.ts` and resolved centrally by `getSessionCapabilities`.

Guest users receive public read capabilities only. Signed-in users receive social mutation, profile management, account and module capabilities.

Feature code should use:

- `useCapability(capability)`
- `requireCapability(capability, action)`
- `RequireCapability`
- `ProtectedActionPrompt`

Protected actions prompt the user at the interaction point. Public browsing remains available to guest and signed-out users.
