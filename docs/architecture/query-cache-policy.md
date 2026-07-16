# Query Cache Policy

TanStack Query owns all server-shaped cache state.

Defaults are configured in `src/data/query/createQueryClient.ts`:

- `staleTime`: 30 seconds
- `gcTime`: 10 minutes
- query retries through `queryRetry`
- mutations do not retry by default
- reconnect refetch enabled
- window-focus refetch disabled

Query keys are centralized in `src/data/query/queryKeys.ts`. Components and screens must not invent array keys.

Local data source queries use `networkMode: 'always'` so local simulation remains available offline. Remote data source queries use `networkMode: 'online'`.

Session identity is included in account-sensitive keys where needed to avoid cross-account cache leakage.
