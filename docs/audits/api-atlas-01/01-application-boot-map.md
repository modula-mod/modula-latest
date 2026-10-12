# Application Boot Map

## Process graph

`services/greenfield-api/src/main.ts:1-8`

`loadConfig() -> createServer() -> app.listen({host, port})`

`services/greenfield-api/src/app/create-server.ts:14-47`

`Fastify -> createDb -> registerPlugins -> registerRoutes -> graceful shutdown`

`services/greenfield-api/src/app/register-plugins.ts:8-41`

1. request-id onRequest hook;
2. global Helmet headers;
3. origin allow-list CORS;
4. non-global Fastify rate limiter when enabled.

`services/greenfield-api/src/app/register-routes.ts:148-214`

1. instantiate domain services;
2. global preHandler attaches legacy and Greenfield bearer authentication;
3. register health/version/meta and primary route families;
4. register module, AI, Backend Fabric, intelligence, social, stories, developer, entitlement, account-data, attachment and provider route groups;
5. handlers perform authorization and validation; no global schema-validation layer or global custom error handler is registered.

## Actual production boot

- Image: `modula-greenfield-api:50dfc12045be639ad65acb95d2b4e94ea864ed42`
- Image ID: `sha256:2ff3363eb9ad68dd569710013adddf38a2d241e7c5b56075bc6daaaaee9c04dc`
- Revision: `50dfc12045be639ad65acb95d2b4e94ea864ed42`
- Command: `docker-entrypoint.sh node services/greenfield-api/dist/main.js`
- Working directory: `/app`
- Host binding: loopback `127.0.0.1:4020 -> container 4020`
- Fastify application routes: 437
- Automatic HEAD routes: 178
- Framework OPTIONS routes: 1

## Registration graph

```mermaid
graph TD
  main[main.ts] --> config[loadConfig]
  main --> server[createServer]
  server --> fastify[Fastify 5]
  server --> db[Kysely PostgreSQL]
  server --> plugins[registerPlugins]
  plugins --> requestId[request ID]
  plugins --> helmet[Helmet]
  plugins --> cors[CORS]
  plugins --> limits[rate limit plugin]
  server --> routes[registerRoutes]
  routes --> auth[global auth attachment preHandler]
  routes --> core[core account/social routes]
  routes --> attachments[attachment routes]
  routes --> modules[module registry/runtime]
  routes --> ai[AI gateway]
  routes --> intelligence[governed intelligence]
  routes --> fabric[Backend Fabric]
  routes --> stories[stories]
  routes --> developer[developer/build]
  server --> shutdown[graceful shutdown]
  main --> listen[listen 0.0.0.0:4020 inside container]
```
