# API Transport Contract

The transport boundary is defined in `src/api/transport/ApiTransport.ts`.

`ApiRequest` contains method, path, optional query, headers, body, abort signal and timeout. `ApiTransportResponse` returns status, headers and an unknown body. Both local and future HTTP transports implement `send(request)`.

`HttpApiTransport` uses `expo/fetch`, encodes query parameters, serializes JSON bodies, applies timeouts and cancellation, parses response content types and returns unknown response bodies. It does not retry internally.

`LocalApiTransport` sends the same request shape to the in-process local API server. Repositories never know which transport is active.

Every decoded API response must pass through `ApiClient` and the manual decoder layer. Feature code must not cast raw JSON into domain types.
