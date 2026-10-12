# MODULE-PLATFORM-02B performance benchmark

The reproducible benchmark is `services/greenfield-api/scripts/mp02b-performance-benchmark.ts`.
It refuses non-local `postgresql://postgres@127.0.0.1:55432/mp02b_integration`, creates a unique disposable schema, loads synthetic fixtures, runs 15 samples per query, reports median/p95 in milliseconds, and drops the schema on exit. No production database is contacted.

Run:

```sh
MODULA_TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:55432/mp02b_integration \
  pnpm --filter @modula/greenfield-api exec tsx scripts/mp02b-performance-benchmark.ts
```

Fixture defaults: 10,000 records, 50,000 revisions, 10,000 references, 10,000 sync changes, 5,000 media bindings and 5,000 shares. The command output is the authoritative metrics evidence; record it here after execution.

## Metrics

| Operation | Samples | Median (ms) | p95 (ms) |
|---|---:|---:|---:|
| record list | 15 | 0.466013 | 2.263931 |
| reverse refs | 15 | 0.110362 | 0.591646 |
| history list | 15 | 0.161422 | 1.017784 |
| sync initial | 15 | 0.319791 | 1.008700 |
| sync incremental | 15 | 0.368959 | 0.789057 |
| media binding list | 15 | 0.132674 | 0.582583 |
| sharing access evaluation | 15 | 0.122379 | 0.621136 |
| governed function overhead | 15 | 0.090825 | 0.192505 |
| inter-module action overhead | 15 | 0.093358 | 0.145110 |
| search | 15 | 0.115349 | 0.438544 |

No arbitrary pass/fail threshold is asserted. Results must be interpreted against the integrated service implementation and compared with a baseline when available.
