import type {ApiMethod, ApiRequest} from '@/api/contracts'
import type {LocalApiDatabase} from '@/api/local/LocalApiDatabase'
import type {MutableLocalApiConfiguration} from '@/api/local/LocalApiConfiguration'
import {createActivityRoutes} from '@/api/local/routes/activityRoutes'
import {createAtprotoRoutes} from '@/api/local/routes/atprotoRoutes'
import {createAuthRoutes} from '@/api/local/routes/authRoutes'
import {createBoardRoutes} from '@/api/local/routes/boardRoutes'
import {createDiscoverRoutes} from '@/api/local/routes/discoverRoutes'
import {createFeedRoutes} from '@/api/local/routes/feedRoutes'
import {createMetaRoutes} from '@/api/local/routes/metaRoutes'
import {createNotificationRoutes} from '@/api/local/routes/notificationRoutes'
import {createPostRoutes} from '@/api/local/routes/postRoutes'
import {createProfileRoutes} from '@/api/local/routes/profileRoutes'
import {createStoryRoutes} from '@/api/local/routes/storyRoutes'

export type LocalApiRouteContext = {
  database: LocalApiDatabase
  configuration: MutableLocalApiConfiguration
  request: ApiRequest
  params: Record<string, string>
  accessToken: string | null
}

export type LocalApiRoute = {
  method: ApiMethod
  path: string
  handler(context: LocalApiRouteContext): Promise<unknown> | unknown
}

function splitPath(path: string): string[] {
  return path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean)
}

function match(pattern: string, path: string): Record<string, string> | null {
  const patternParts = splitPath(pattern)
  const pathParts = splitPath(path)
  if (patternParts.length !== pathParts.length) return null
  const params: Record<string, string> = {}
  for (let index = 0; index < patternParts.length; index += 1) {
    const expected = patternParts[index]
    const actual = pathParts[index]
    if (expected.startsWith(':')) {
      params[expected.slice(1)] = decodeURIComponent(actual)
      continue
    }
    if (expected !== actual) return null
  }
  return params
}

export class LocalApiRouter {
  private readonly routes: LocalApiRoute[]

  constructor(
    private readonly database: LocalApiDatabase,
    private readonly configuration: MutableLocalApiConfiguration,
  ) {
    this.routes = [
      ...createMetaRoutes(),
      ...createAuthRoutes(database, configuration),
      ...createFeedRoutes(database),
      ...createPostRoutes(database),
      ...createProfileRoutes(database),
      ...createBoardRoutes(database),
      ...createActivityRoutes(database),
      ...createNotificationRoutes(database),
      ...createDiscoverRoutes(database),
      ...createStoryRoutes(database),
      ...createAtprotoRoutes(),
    ]
  }

  async handle(request: ApiRequest): Promise<unknown> {
    const accessToken = request.headers?.Authorization?.replace(/^Bearer\s+/i, '') ?? null
    for (const route of this.routes) {
      if (route.method !== request.method) continue
      const params = match(route.path, request.path)
      if (!params) continue
      return route.handler({
        database: this.database,
        configuration: this.configuration,
        request,
        params,
        accessToken,
      })
    }
    throw new Error('Route not found.')
  }
}
