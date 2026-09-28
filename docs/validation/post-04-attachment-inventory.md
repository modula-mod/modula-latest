# POST-04 Greenfield attachment inventory

Date: 2026-09-27
Start: `966440fe64efc4c88350ce6423795965a5c62013` (`origin/main`)

## Existing platform truth

- Greenfield API is Fastify/TypeScript/Kysely/PostgreSQL with ordered SQL up/down migrations (latest accepted migration `056`).
- Social writes already require authentication, `post:create`, mutation policy, rate limits, and author-scoped idempotency keys.
- `PostRepository` embeds ordered `post_media` metadata in feed/detail responses.
- Current media upload is `PostMediaStorage`: one base64 JPEG/PNG/WebP in the post-create body, max 2 MiB by default, written to `MODULA_MEDIA_ROOT/posts`.
- Current validation trusts declared MIME/dimensions after base64 shape/size checks; it has no upload session, signature/checksum verification, first-class ownership, processing state, or cross-feature attachment identity.
- Story binary storage is separately scoped and is not an appropriate attachment platform.
- No operational S3/R2/MinIO/direct-object-upload adapter is present. Filesystem is the accepted storage provider for this staged implementation.
- The API has structured logging/redaction, capability enforcement, policy evaluation, outbox/background-job infrastructure, and migration/test harnesses that should be reused.

## Platform decision

Introduce generic `attachments` and `attachment_upload_sessions` entities plus ordered `post_content` bindings. Store provider/key, never filesystem paths or permanent storage URLs. Serve content by attachment ID after authorization. The upload-session response uses an authenticated streaming API `PUT` for the current filesystem provider and remains compatible with a future signed object-storage URL.

Legacy `post_media` remains readable for existing posts. New writes use attachment IDs; no data wipe or forced rewrite is required.

## Security boundary

- Add `attachment:upload` to standard authenticated sessions and require it on session creation/upload/status operations.
- Enforce owner account on every upload/session lookup and again when binding to a post.
- Central per-kind limits, expiry, actual signature detection, checksum, exact byte count, allowed MIME families, safe generated storage keys, and single-use sessions are server-authoritative.
- Reject executable/unsupported bytes, MIME mismatches, expired/reused sessions, unready attachments, invalid IDs, and cross-account binding.
- Orphaned ready attachments remain unattached for a retention window and are cleanup-eligible; composer dismissal does not immediately destroy retryable assets.

## Scope control

No transcoding farm, Office rendering, crawler, waveform generation, OCR, private-media ACL redesign, or product-specific duplicate storage service is introduced. Image/PDF metadata is extracted where practical; native QuickLook remains authoritative for generic documents.
