# Client Capability Coverage

This matrix compares product capabilities, not assumed literal URLs, against current GreenField behavior. Counts: BACKEND ONLY=2, CLIENT ONLY=3, COMPLETE=34, MISSING=2, PARTIAL=10.

| Domain | Capability | Status | Evidence/explanation |
| --- | --- | --- | --- |
| Authentication | `/auth/login` | **COMPLETE** | POST /v1/sessions is implemented and called by the product client. |
| Authentication | `/auth/register` | **COMPLETE** | POST /v1/accounts/register implements open production registration. |
| Authentication | `/auth/verify` | **COMPLETE** | Email verification and resend routes exist. |
| Authentication | `/auth/forgot` | **COMPLETE** | Forgot-password request exists with the auth-specific rate tier. |
| Authentication | `/auth/reset` | **COMPLETE** | Token reset and authenticated password-change paths exist. |
| Authentication | `/auth/welcome` | **CLIENT ONLY** | Welcome is a client navigation state; no server capability is required or registered. |
| Home | `/home/following` | **COMPLETE** | GET /v1/feed/home?mode=following uses the follow graph and visibility policy. |
| Home | `/home/for-you` | **PARTIAL** | Backend ranking exists, but it is deterministic and an invalid mode silently falls into the modules label. |
| Home | `/home/modules` | **COMPLETE** | GET /v1/feed/home?mode=modules filters module-feed posts. |
| Discover | `/discover/trending` | **PARTIAL** | The single /v1/discover aggregate reads seeded/materialized trending_topics; no calculation job was found. |
| Discover | `/discover/people` | **COMPLETE** | The aggregate returns privacy-filtered public suggested profiles. |
| Discover | `/discover/topics` | **PARTIAL** | Topics are returned from a table without pagination or a discovered trend producer. |
| Discover | `/discover/posts` | **PARTIAL** | Media and reels are returned, not a general paginated post discovery collection. |
| Discover | `/discover/modules` | **PARTIAL** | Featured module payloads are returned from featured_modules without a live ranking producer. |
| Search | `/search` | **COMPLETE** | Universal search, sanitation, ranking and visibility filters share GET /v1/search. |
| Search | `/search/people` | **COMPLETE** | People is an entity-type query on universal search. |
| Search | `/search/posts` | **COMPLETE** | Posts is an entity-type query on universal search. |
| Search | `/search/modules` | **COMPLETE** | Modules is an entity-type query on universal search. |
| Profile | `/profile/:id` | **COMPLETE** | Profile retrieval and viewer relationship state are implemented. |
| Profile | `/profile/:id/posts` | **COMPLETE** | Cursor-paginated visible posts are implemented. |
| Profile | `/profile/:id/modules` | **MISSING** | No profile-scoped installed/featured module endpoint is registered. |
| Profile | `/profile/:id/links` | **PARTIAL** | Public links are embedded in profile serialization; no link CRUD route writes profile_links. |
| Profile | `/profile/:id/followers` | **COMPLETE** | Lists and protected visibility now depend on accepted follows; Native must adopt pending state. |
| Profile | `/profile/:id/following` | **COMPLETE** | Lists and protected visibility now depend on accepted follows; Native must adopt pending state. |
| Profile | `/profile/:id/follow-requests` | **BACKEND ONLY** | Request, incoming list, accept, reject and cancel routes are live; Native UI adoption is pending. |
| Module | `/module/:id` | **COMPLETE** | Registry detail is public and installation state can be hydrated for signed-in clients. |
| Module | `/module/:id/permissions` | **PARTIAL** | Missing reviews now grant nothing; two existing installations still require explicit user review. |
| Module | `/module/:id/whats-new` | **BACKEND ONLY** | Release notes are embedded in detail/version responses rather than a dedicated surface. |
| Module | `/module/:id/screenshots` | **PARTIAL** | Presentation metadata exists, but 7 of 17 assets have no blob and all are development assets. |
| Module | `/module/:id/versions` | **COMPLETE** | Public registry and authenticated installed-version routes exist. |
| Settings | `account` | **COMPLETE** | Account, handle, password, sessions, deletion and data-request APIs exist. |
| Settings | `privacy` | **PARTIAL** | Profile visibility, block, mute and follower approval exist; complete export controls remain incomplete. |
| Settings | `security` | **COMPLETE** | Passkeys, TOTP, recovery codes, step-up and session revocation exist. |
| Settings | `appearance` | **COMPLETE** | GET/PATCH account appearance exists and is called. |
| Settings | `developer` | **COMPLETE** | Developer profile, releases and build-service coordination routes exist. |
| Activity | `notifications` | **COMPLETE** | Account-scoped list, mark-read and mark-all-read routes exist. |
| Activity | `requests` | **MISSING** | No follow-request/activity-request API or persistence surface is registered. |
| Activity | `mentions` | **PARTIAL** | Mention jobs/notification types exist, but there is no dedicated mentions query/filter contract. |
| Post | `detail` | **COMPLETE** | Viewer-aware post detail with author, reaction, share and content hydration exists. |
| Post | `comments` | **COMPLETE** | Independent cursor lists, replies, edit, delete and reactions exist. |
| Post | `likes/reactions` | **COMPLETE** | Legacy like and canonical typed reaction routes are both implemented. |
| Post | `shares` | **COMPLETE** | Shares, reposts and quote posts are persisted separately. |
| Post | `edit` | **COMPLETE** | Owner-only optimistic-version text edit exists. |
| Post | `delete` | **COMPLETE** | Owner policy and soft deletion exist. |
| Composer | `text` | **COMPLETE** | Text create is persisted. |
| Composer | `photo` | **COMPLETE** | Canonical attachments and legacy one-image upload both persist and serve. |
| Composer | `link` | **CLIENT ONLY** | Client sends linkPreview, but the server CreatePostInput has no link field and create does not persist it. |
| Composer | `poll` | **CLIENT ONLY** | Client explicitly labels polls outside beta; no poll request, table or route exists. |
| Composer | `carousel` | **COMPLETE** | Canonical post content accepts up to ten owned ready attachments. |
| Composer | `audio` | **COMPLETE** | Canonical attachments accept and hydrate audio content. |
| Composer | `video` | **COMPLETE** | Canonical attachments accept video; reels project ready public video posts. |

## Source caller analysis

- 142 statically observed path-property call sites outside tests/local mocks.
- 142 matched a runtime route; 0 need dynamic/manual disposition.
- Route-level caller arrays in `api-atlas.json` also include server-to-server references and automated tests.

No unmatched literal client paths.

## Coverage interpretation

- `BACKEND ONLY` means GreenField returns the information but not as the exact dedicated product capability.
- `CLIENT ONLY` means the UI/type exists without a server persistence contract.
- Static no-caller is not proof of dead traffic: computed paths and external clients can evade source analysis. The dead-route candidates are therefore recorded for telemetry, not deletion.
