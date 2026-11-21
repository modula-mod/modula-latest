# GreenField v1 error-code freeze

The authoritative inventory and HTTP mapping is
`packages/api-contracts/src/errors.ts`; `statusForError` consumes that exhaustive
map. All normal failures use the API envelope with request ID and retryability.
No stack trace, SQL detail, token, secret, or raw private payload belongs in a
client response.

Critical module/distribution mappings are frozen as follows:

| Code | HTTP | Meaning |
|---|---:|---|
| `PERMISSION_REVIEW_REQUIRED` | 403 | Exact installed release has no accepted review. |
| `MODULE_PERMISSION_DENIED` | 403 | Review does not grant the required capability. |
| `INSTALLATION_DISABLED` | 403 | Runtime use is disabled. |
| `UNTRUSTED_RELEASE` | 403 | Release trust cannot be established. |
| `RELEASE_REVOKED` | 403 | Release was explicitly revoked. |
| `SIGNER_REVOKED` | 403 | Signing key was explicitly revoked. |
| `REVISION_CONFLICT` | 409 | Expected revision is stale. |
| `MUTATION_REUSE_CONFLICT` | 409 | Same mutation ID was reused with a different payload. |
| `INVALID_CURSOR` | 400 | Cursor is malformed, expired, or invalid for the scope. |
| `FUNCTION_NOT_AVAILABLE` | 404 | Exact declared function/version is unavailable. |
| `CAPABILITY_UNAVAILABLE` | 503 | Required host/runtime capability cannot execute. |
| `HOST_VERSION_TOO_OLD` | 409 | Host is outside declared compatibility. |
| `ARTIFACT_DIGEST_MISMATCH` | 409 | Stored/downloaded bytes do not match registry truth. |
| `RATE_LIMITED` | 429 | Bounded rejection; response includes `Retry-After`. |

Authentication amendment (GF-AUTH resumable verification, additive code):

| Code | HTTP | Meaning |
|---|---:|---|
| `EMAIL_VERIFICATION_REQUIRED` | 403 | Correct password for an account whose email is not yet verified; `details` carries a fresh `challengeId`, `expiresAt` and `delivery`. Previously this case returned `INVALID_CREDENTIALS` (401). |

Known accepted residual risks from the GF-AUTH resumable-verification change
(Sentinel report §36; ATLAS accepted these as low, 2026-11-15):

- **R2:** Anonymous resends for an unregistered email can exhaust that address's
  per-email verification-send limit and block its registration with
  `RATE_LIMITED` (429) for about 10 minutes. The requester can renew the lockout
  by sending again when the window resets.
- **R3:** Within 10 minutes of a registration, the per-email 429 arrives one
  resend earlier than it would for an unregistered email, which can leak that
  the address was just registered.
- **R4:** A decoy resend is about 1 ms faster than a real resend because it
  skips the mail-job insert.

`NOTE_REVISION_CONFLICT` is the sole bounded compatibility alias and maps to
canonical `REVISION_CONFLICT`. New code must emit the canonical value.

