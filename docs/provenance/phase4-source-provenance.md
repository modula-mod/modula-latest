# Phase 4 Source Provenance

Phase 4 implementation is local application code in `/home/andrei/modula-latest`.

Runtime dependencies added through package manager commands:

- `pnpm add @tanstack/react-query`
- `pnpm exec expo install expo-secure-store expo-network`

`expo-secure-store` was added to `app.config.ts` manually because Expo could not auto-write the dynamic config file.

No Axios, SWR, Redux Toolkit, Zustand, MSW, Apollo, Firebase, Supabase, OAuth, JWT parsing, SQLite or query-cache persistence package was added.

The local API simulator uses migrated Phase 1-3 seed records as local development data. It does not connect to a production API or database.
