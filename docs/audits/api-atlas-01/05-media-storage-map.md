# Media and Storage Map

## Production storage

- Backend: host filesystem bind at `/var/lib/modula/greenfield-media` mounted read/write into the API container.
- Durability: survives container replacement, but no replicated object store, CDN origin, storage health check or host-loss recovery proof was discovered.
- Inventory: 45 files / 24378792 bytes. No file contents or user metadata were copied into the atlas.

| Class | Files | Bytes | API family |
| --- | --- | --- | --- |
| attachments | 18 | 19171402 | `/v1/attachments/*` |
| posts | 13 | 887529 | `/v1/posts`, `/v1/media/*` |
| profiles | 3 | 1224761 | `/v1/profiles/*/(avatar|cover)` |
| stories | 11 | 3095100 | `/v1/stories`, `/v1/media/stories/*` |

## Canonical attachment lifecycle

1. `POST /v1/attachments/uploads` creates an account-owned session and validates declared MIME/size (`services/greenfield-api/src/domains/attachments/policy.ts:15`).
2. `PUT /v1/attachments/uploads/:uploadId/content` streams raw bytes, bounds length, hashes them and checks file signatures (`services/greenfield-api/src/domains/attachments/service.ts:117`, `:266`).
3. Metadata and state are stored in PostgreSQL; bytes are atomically placed under the media root.
4. Profile avatar/cover binding requires the same owner, ready state and image kind (`services/greenfield-api/src/domains/profiles/writes.ts:292`). Post content accepts up to ten ready owned attachments.
5. `GET /v1/attachments/:attachmentId/content` resolves public/private/owner access and streams the file through nginx.
6. Delete/cleanup support exists in the service, but no production scheduler invokes orphan cleanup.

Current attachment states: ready=18, failed=1, created=2, expired=1. Ready linkage: 13/18 linked, 5 orphan candidates.

## Media-class disposition

| Class | Bytes | Metadata | URL and policy | Deletion/durability |
| --- | --- | --- | --- | --- |
| Avatar/cover | canonical attachment bytes or external URL | profile_media (cover=1, avatar=1) | canonical attachment URL is policy-checked; PATCH also accepts public HTTPS URL | binding removal does not establish object garbage collection |
| Post attachments | attachment store | post_content (pdf=2, audio=1, image=5, video=2, document=1) | viewer visibility follows post plus attachment policy | soft post deletion; orphan cleanup unscheduled |
| Legacy post image | posts directory | post_media count=16 | `/v1/media/:mediaFile`; public path follows post policy | 13/16 active rows have a URL; 20 MiB app limit conflicts with 1 MiB nginx default |
| Stories | stories directory | story_items count=11 | `/v1/media/stories/:mediaFile` with story visibility | 11 inactive/deleted rows and 11 files remain |
| Module packages | PostgreSQL release blob/ref metadata | 2/14 release blobs | public artifact route when blob is available; digest checked | immutable metadata, incomplete byte coverage |
| Module artwork | PostgreSQL blobs plus presentation metadata | 10/17 blobs | public immutable cache route; unavailable metadata returns 404 | all 17 are marked development assets |

## Confirmed gaps

- Database paths can be non-servable: 7 module presentation records lack blobs; 3 active legacy post-media rows lack URLs.
- Profile media has two competing trust/ownership paths: attachment binding and arbitrary public HTTPS URL.
- Story upload checks declared labels/base64 length but does not reuse decoded-byte magic validation; deleting a story does not remove its file.
- nginx is the delivery path; there is no separate CDN/object-store authorization layer. Registry assets alone receive immutable cache handling.
- The attachment content endpoint returns 403 for an existing private object and 404 for unknown, exposing existence to a caller who learns an identifier.
