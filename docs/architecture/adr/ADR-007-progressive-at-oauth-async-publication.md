# ADR-007 — Progressive AT OAuth and asynchronous publication

## Status
Accepted (Phase 6)

## Decision
- Use official AT OAuth libraries only (`@atproto/oauth-client-node` / Expo client on Mac)
- Request identity scope first (`atproto`); request publishing scopes only after explicit user enablement
- Keep Modula PostgreSQL canonical for Modula-origin posts
- Publish to AT Protocol asynchronously via outbox + worker after Modula commit
- AT publication failure must never roll back an already committed Modula post

## Consequences
- Private Modula data never enters AT repositories
- Cross-posting defaults to Modula-only
- Worker lease/retry/dead-letter policy isolates external PDS volatility
