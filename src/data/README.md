# Modula Data Runtime

TanStack Query owns server-shaped state. Screens consume feature hooks, which
use repositories. Repositories use `ApiClient`; they do not know whether the
active transport is the local simulator or a future HTTP backend.
