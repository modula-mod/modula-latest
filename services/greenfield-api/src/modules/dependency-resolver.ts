import {satisfiesSemverRange, type GreenfieldModuleDependency} from '@modula/greenfield-module-manifest'
import type {ModulaDb} from '../database/client.js'

export type DependencyResolutionInput = {
  moduleId: string
  dependencies: GreenfieldModuleDependency[]
  accountId?: string
}

export type DependencyResolutionPlan = {
  dependencies: Array<{
    moduleId: string
    requestedRange: string
    resolvedVersion: string | null
    installed: boolean
    optional: boolean
  }>
  installable: boolean
  circular: boolean
  errors: string[]
}

export class GreenfieldModuleDependencyResolver {
  constructor(private readonly db: ModulaDb) {}

  async resolve(input: DependencyResolutionInput): Promise<DependencyResolutionPlan> {
    const errors: string[] = []
    const circular = await this.detectCircular(input.moduleId, input.dependencies)
    if (circular) errors.push('Circular module dependency graph rejected')
    const dependencies = []
    for (const dependency of input.dependencies) {
      if (dependency.moduleId === input.moduleId) {
        errors.push(`Module ${input.moduleId} cannot depend on itself`)
      }
      const releases = await this.db
        .selectFrom('greenfield_module_releases')
        .select(['module_id', 'version', 'release_state'])
        .where('module_id', '=', dependency.moduleId)
        .where('release_state', '=', 'published')
        .orderBy('version', 'desc')
        .execute()
      const resolved = releases.find(row => satisfiesSemverRange(row.version, dependency.versionRange))
      const installed = input.accountId ? await this.isInstalled(input.accountId, dependency.moduleId, resolved?.version ?? null) : false
      dependencies.push({
        moduleId: dependency.moduleId,
        requestedRange: dependency.versionRange,
        resolvedVersion: resolved?.version ?? null,
        installed,
        optional: dependency.optional,
      })
      if (!resolved && !dependency.optional) errors.push(`Required dependency ${dependency.moduleId}@${dependency.versionRange} is unavailable`)
    }
    dependencies.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
    return {dependencies, installable: errors.length === 0, circular, errors}
  }

  async activeDependants(accountId: string, moduleId: string) {
    const rows = await this.db
      .selectFrom('greenfield_module_dependencies')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.release_id', 'greenfield_module_dependencies.release_id')
      .innerJoin('greenfield_extension_installations', 'greenfield_extension_installations.extension_version_id', 'greenfield_module_releases.extension_version_id')
      .select(['greenfield_module_releases.module_id', 'greenfield_module_releases.version', 'greenfield_extension_installations.status'])
      .where('greenfield_module_dependencies.dependency_module_id', '=', moduleId)
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where('greenfield_extension_installations.status', 'in', ['installedDisabled', 'enabling', 'enabled', 'disabling', 'disabled', 'updating'])
      .execute()
    return rows
  }

  private async detectCircular(moduleId: string, dependencies: GreenfieldModuleDependency[]): Promise<boolean> {
    const required = dependencies.filter(dependency => !dependency.optional).map(dependency => dependency.moduleId)
    if (required.includes(moduleId)) return true
    const visited = new Set<string>()
    const stack = [...required]
    while (stack.length > 0) {
      const next = stack.pop()!
      if (visited.has(next)) continue
      visited.add(next)
      const rows = await this.db
        .selectFrom('greenfield_module_dependencies')
        .innerJoin('greenfield_module_releases', 'greenfield_module_releases.release_id', 'greenfield_module_dependencies.release_id')
        .select(['greenfield_module_dependencies.dependency_module_id'])
        .where('greenfield_module_releases.module_id', '=', next)
        .where('greenfield_module_dependencies.optional', '=', false)
        .where('greenfield_module_releases.release_state', '=', 'published')
        .execute()
      for (const row of rows) {
        if (row.dependency_module_id === moduleId) return true
        stack.push(row.dependency_module_id)
      }
    }
    return false
  }

  private async isInstalled(accountId: string, moduleId: string, version: string | null): Promise<boolean> {
    if (!version) return false
    const row = await this.db
      .selectFrom('greenfield_extension_installations')
      .innerJoin('greenfield_module_releases', 'greenfield_module_releases.extension_version_id', 'greenfield_extension_installations.extension_version_id')
      .select('greenfield_extension_installations.installation_id')
      .where('greenfield_extension_installations.account_id', '=', accountId)
      .where('greenfield_module_releases.module_id', '=', moduleId)
      .where('greenfield_module_releases.version', '=', version)
      .where('greenfield_extension_installations.status', 'in', ['installedDisabled', 'enabling', 'enabled', 'disabling', 'disabled', 'updating'])
      .executeTakeFirst()
    return Boolean(row)
  }
}
