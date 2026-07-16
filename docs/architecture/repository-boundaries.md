# Repository Boundaries

Repository contracts live under `src/data/repositories/contracts`.

API-backed implementations live under `src/data/repositories/api` and consume `ApiClient`. There are no separate local repositories that bypass API semantics.

Feature screens consume hooks under feature folders:

- Feed: `src/features/feed/data`
- Profile: `src/features/profile/data-query`
- Activity: `src/features/activity/data`
- Discovery: `src/features/discover/data`
- Reels: `src/features/reels/data`
- Saved posts: `src/features/saved/data`

Screens must not call `fetch`, import local seed data, read secure storage, parse DTOs or construct authentication headers.
