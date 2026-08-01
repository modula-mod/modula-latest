# Greenfield AI Streaming

Block 9 uses Server-Sent Events as the provider-neutral streaming transport.

Routes:

- `POST /v1/modules/:moduleId/ai/requests`
- `GET /v1/ai/executions/:executionId/stream`
- `POST /v1/ai/executions/:executionId/cancel`
- `GET /v1/ai/executions/:executionId`

Provider events are normalised before persistence or replay:

- `execution.started`
- `content.delta`
- `reasoning.status`
- `tool.requested`
- `usage.updated`
- `execution.completed`
- `execution.failed`
- `execution.cancelled`
- `heartbeat`

Hidden model reasoning and provider-specific internal fields are never exposed. `reasoning.status` may only expose high-level states such as `analysing`, `validating` or `preparing-response`.

Stream state is stored in `ai_stream_sessions` and `ai_stream_events`. Reconnect uses an authenticated account-isolated execution lookup plus a cursor or `Last-Event-ID`. Replay is bounded by event expiry. Raw token chunks are not retained beyond the configured replay lifetime.

Cancellation is idempotent at the Greenfield execution boundary. If the provider cannot cancel natively, Greenfield marks the execution cancelled, stops forwarding output, disables retries and records late usage metadata without delivering late content.
