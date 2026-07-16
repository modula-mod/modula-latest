# Local API Simulator

The Phase 4 simulator is an in-process API service, not an HTTP server.

Flow:

`LocalApiTransport.send -> LocalApiServer.handle -> LocalApiRouter.match -> route handler -> LocalApiDatabase -> ApiEnvelope`

The simulator supports seeded accounts, profiles, posts, follows, likes, saves, reposts, activity, discovery and reels. It uses cursor pages for feed, profile feed, activity, followers, following, reels and saved posts.

Development controls are exposed through the Data Runtime and Session Runtime screens. The controller can reset local data, change latency, force failure modes, expire access tokens and invalidate refresh tokens.

Local data intentionally resets when the JavaScript runtime reloads. Presentation settings may persist. Native refresh-token simulation may persist until sign-out or reset.

The simulator is not production security and does not represent a production backend.
