# AI Provider Health And Recovery

Provider health is tracked without exposing credentials or raw provider responses.

Health states:

- `healthy`
- `degraded`
- `rate-limited`
- `authentication-failed`
- `unavailable`
- `disabled`
- `unknown`

Health components:

- Configuration.
- Credentials.
- Network.
- Model discovery.
- Execution.
- Streaming.
- Structured output.

Diagnostics may include provider state, last health check, latency, failure rates, rate-limit state, configured model count, successful execution count, failed execution count and active streams.

Circuit breaking is provider-scoped and may be model-scoped. States are `closed`, `open` and `half-open`. Repeated retryable provider failures open the circuit for the configured duration. Authentication failures do not retry repeatedly.

Recovery flow:

1. Inspect `GET /v1/admin/ops/ai/providers`.
2. Verify the provider through `POST /v1/admin/ops/ai/providers/:providerId/verify`.
3. Rotate or replace credentials if the state is `authentication-failed`.
4. Disable a provider before planned maintenance.
5. Re-enable only after health verifies.
6. Keep routing metadata and audit records for incident review.
