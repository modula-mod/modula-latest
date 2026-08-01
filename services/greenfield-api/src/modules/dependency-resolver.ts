import {
  dependencyProvidesFromManifest,
  dependencyRequestsFromManifest,
  satisfiesSemverRange,
  type GreenfieldModuleDependency,
  type GreenfieldModuleDependencyRequest,
  type GreenfieldModuleManifest,
} from '@modula/greenfield-module-manifest'
import type {ModulaDb} from '../database/client.js'

export type DependencyResolutionInput = {
  moduleId: string
  manifest?: GreenfieldModuleManifest
  dependencies?: GreenfieldModuleDependency[]
  accountId?: string
}

export type DependencyResolutionPlan = {
  dependencies: Array<{
    moduleId: string
    provides: string | null
    relation: GreenfieldModuleDependencyRequest['relation']
    requestedRange: string
    resolvedVersion: string | null
    resolvedModuleId: string | null
    installed: boolean
    optional: boolean
    blocking: boolean
    satisfied: boolean
    reason?: string
  }>
  provides: Array<{id: string; title: string; version: string; kind: 'service' | 'api' | 'record' | 'capability' | 'engine' | 'integration' | 'ui'}>
  installable: boolean
  circular: boolean
  errors: string[]
  warnings: string[]
}

export class GreenfieldModuleDependencyResolver {
  constructor(private readonly db: ModulaDb) {}

  async resolve(input: DependencyResolutionInput): Promise<DependencyResolutionPlan> {
    const errors: string[] = []
    const warnings: string[] = []
    const requests = input.manifest
      ? dependencyRequestsFromManifest(input.manifest)
      : (input.dependencies ?? []).map(dependency => ({
          relation: dependency.optional ? 'optional' as const : 'requires' as const,
          moduleId: dependency.moduleId,
          provides: null,
          versionRange: dependency.versionRange,
          optional: dependency.optional,
          blocking: !dependency.optional,
          reason: dependency.reason,
        }))
    const provides = input.manifest ? dependencyProvidesFromManifest(input.manifest) : []
    const circular = await this.detectCircular(input.moduleId, requests)
    if (circular) errors.push('Circular module dependency graph rejected')
    const dependencies = []
    for (const dependency of requests) {
      if (dependency.moduleId === input.moduleId) {
        errors.push(`Module ${input.moduleId} cannot depend on itself`)
      }
      const resolved = dependency.moduleId
        ? await this.resolveModuleDependency(dependency.moduleId, dependency.versionRange)
        : await this.resolveProvidedContract(dependency.provides, dependency.versionRange)
      const installed = input.accountId && resolved ? await this.isInstalled(input.accountId, resolved.moduleId, resolved.version) : false
      const isConflict = dependency.relation === 'conflicts'
      const blocking = dependency.blocking || (isConflict && installed)
      const satisfied = isConflict ? !installed : Boolean(resolved)
      dependencies.push({
        moduleId: dependency.moduleId ?? resolved?.moduleId ?? dependency.provides ?? 'unknown',
        provides: dependency.provides,
        relation: dependency.relation,
        requestedRange: dependency.versionRange,
        resolvedVersion: resolved?.version ?? null,
        resolvedModuleId: resolved?.moduleId ?? null,
        installed,
        optional: dependency.optional,
        blocking,
        satisfied,
        reason: dependency.reason,
      })
      if (!resolved && !dependency.optional) errors.push(`Required dependency ${(dependency.moduleId ?? dependency.provides) as string}@${dependency.versionRange} is unavailable`)
      if (dependency.relation === 'recommended' && !resolved) warnings.push(`Recommended dependency ${(dependency.moduleId ?? dependency.provides) as string}@${dependency.versionRange} is unavailable`)
      if (isConflict && installed) errors.push(`Conflicting module ${resolved?.moduleId ?? dependency.moduleId ?? dependency.provides} is installed`)
    }
    dependencies.sort((a, b) => a.moduleId.localeCompare(b.moduleId))
    return {dependencies, provides, installable: errors.length === 0, circular, errors, warnings}
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

  private async detectCircular(moduleId: string, dependencies: GreenfieldModuleDependencyRequest[]): Promise<boolean> {
    const required = dependencies.filter(dependency => dependency.relation === 'requires' && dependency.moduleId).map(dependency => dependency.moduleId!)
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

  private async resolveModuleDependency(moduleId: string, versionRange: string): Promise<{moduleId: string; version: string} | null> {
    const releases = await this.db
      .selectFrom('greenfield_module_releases')
      .select(['module_id', 'version', 'release_state'])
      .where('module_id', '=', moduleId)
      .where('release_state', '=', 'published')
      .orderBy('version', 'desc')
      .execute()
    const resolved = releases.find(row => satisfiesSemverRange(row.version, versionRange))
    return resolved ? {moduleId: resolved.module_id, version: resolved.version} : null
  }

  private async resolveProvidedContract(provides: string | null, versionRange: string): Promise<{moduleId: string; version: string} | null> {
    if (!provides) return null
    const releases = await this.db
      .selectFrom('greenfield_module_releases')
      .innerJoin('greenfield_module_versions', 'greenfield_module_versions.module_version_id', 'greenfield_module_releases.module_version_id')
      .select(['greenfield_module_releases.module_id', 'greenfield_module_releases.version', 'greenfield_module_versions.manifest'])
      .where('greenfield_module_releases.release_state', '=', 'published')
      .orderBy('greenfield_module_releases.module_id')
      .execute()
    for (const row of releases as any[]) {
      const provider = dependencyProvidesFromManifest(row.manifest).find(contract => contract.id === provides && satisfiesSemverRange(contract.version, versionRange))
      if (provider) return {moduleId: row.module_id, version: row.version}
    }
    return null
  }
}
