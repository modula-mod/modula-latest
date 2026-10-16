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

`NOTE_REVISION_CONFLICT` is the sole bounded compatibility alias and maps to
canonical `REVISION_CONFLICT`. New code must emit the canonical value.

