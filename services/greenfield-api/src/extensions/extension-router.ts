/**
 * Extension HTTP surface is registered from `app/register-routes.ts`.
 * This module documents the Greenfield extension route boundary for the kernel.
 */
export const GREENFIELD_EXTENSION_ROUTES = [
  'GET /v1/extensions',
  'GET /v1/extensions/:extensionId',
  'GET /v1/extensions/installed',
  'POST /v1/extensions/:extensionId/install',
  'DELETE /v1/extensions/:extensionId/install',
  'PATCH /v1/extensions/:extensionId/preferences',
  'GET /v1/tools',
  'GET /v1/tools/:toolId',
  'GET /v1/functions',
  'POST /v1/functions/:functionId/invoke',
  'GET /v1/plugins',
  'GET /v1/connectors',
  'GET /v1/widgets',
  'GET /v1/modules',
] as const
