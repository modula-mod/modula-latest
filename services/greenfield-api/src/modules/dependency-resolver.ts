import {
  compareSemver,
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
  cyclePath: string[]
  graphDepth: number
  graphNodes: number
  errors: string[]
  warnings: string[]
}

export class GreenfieldModuleDependencyResolver {
  constructor(private readonly db: ModulaDb) {}

  async resolve(input: DependencyResolutionInput): Promise<DependencyResolutionPlan> {
    const errors: string[] = []
    const warnings: string[] = []
    const manifestRequests = input.manifest
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
    const extensionTargets = input.manifest && (input.manifest as any).extensionProduct?.targets
      ? ((input.manifest as any).extensionProduct.targets as Array<{productId: string; versionRange: string}>).map(target => ({
          relation: 'requires' as const,
          moduleId: target.productId,
          provides: null,
          versionRange: target.versionRange,
          optional: false,
          blocking: true,
          reason: 'Standard 2.1 extension target',
        }))
      : []
    const requests = [...manifestRequests, ...extensionTargets].filter((request, index, all) =>
      all.findIndex(candidate => candidate.moduleId === request.moduleId && candidate.provides === request.provides && candidate.relation === request.relation) === index,
    )
    const provides = input.manifest ? dependencyProvidesFromManifest(input.manifest) : []
    const graphPolicy = ((input.manifest as any)?.extensionProduct?.graphPolicy ?? {}) as {maxDepth?: number; maxNodes?: number}
    const graph = await this.inspectGraph(input.moduleId, requests, {
      maxDepth: Math.min(graphPolicy.maxDepth ?? 16, 32),
      maxNodes: Math.min(graphPolicy.maxNodes ?? 256, 1024),
    })
    const circular = graph.cyclePath.length > 0
    if (circular) errors.push(`DEPENDENCY_CYCLE: ${graph.cyclePath.join(' -> ')}`)
    if (graph.limitExceeded) errors.push(`DEPENDENCY_GRAPH_BOUNDS_EXCEEDED: maxDepth=${graph.maxDepth}, maxNodes=${graph.maxNodes}`)
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
    return {dependencies, provides, installable: errors.length === 0, circular, cyclePath: graph.cyclePath, graphDepth: graph.depth, graphNodes: graph.nodes, errors, warnings}
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

  private async inspectGraph(moduleId: string, dependencies: GreenfieldModuleDependencyRequest[], limits: {maxDepth: number; maxNodes: number}) {
    const proposed = dependencies
      .filter(dependency => dependency.relation === 'requires' && dependency.moduleId)
      .map(dependency => dependency.moduleId!)
      .sort()
    const adjacency = new Map<string, string[]>([[moduleId, proposed]])
    const visited = new Set<string>()
    const active = new Set<string>()
    let cyclePath: string[] = []
    let depth = 0
    let limitExceeded = false

    const neighbours = async (productId: string): Promise<string[]> => {
      const cached = adjacency.get(productId)
      if (cached) return cached
      const [dependencies, targets] = await Promise.all([
        this.db
          .selectFrom('greenfield_module_dependencies')
          .innerJoin('greenfield_module_releases', 'greenfield_module_releases.release_id', 'greenfield_module_dependencies.release_id')
          .select(['greenfield_module_dependencies.dependency_module_id'])
          .where('greenfield_module_releases.module_id', '=', productId)
          .where('greenfield_module_dependencies.optional', '=', false)
          .where('greenfield_module_releases.release_state', '=', 'published')
          .execute(),
        this.db
          .selectFrom('greenfield_extension_targets')
          .innerJoin('greenfield_module_releases', 'greenfield_module_releases.release_id', 'greenfield_extension_targets.release_id')
          .select(['greenfield_extension_targets.target_product_id'])
          .where('greenfield_module_releases.module_id', '=', productId)
          .where('greenfield_module_releases.release_state', '=', 'published')
          .execute(),
      ])
      const result = Array.from(new Set([
        ...dependencies.map(row => row.dependency_module_id),
        ...targets.map(row => row.target_product_id),
      ])).sort()
      adjacency.set(productId, result)
      return result
    }

    const visit = async (productId: string, path: string[]): Promise<void> => {
      if (cyclePath.length || limitExceeded) return
      depth = Math.max(depth, path.length)
      if (path.length > limits.maxDepth || visited.size >= limits.maxNodes) {
        limitExceeded = true
        return
      }
      if (active.has(productId)) {
        const first = path.indexOf(productId)
        cyclePath = [...path.slice(first), productId]
        return
      }
      if (visited.has(productId)) return
      active.add(productId)
      for (const next of await neighbours(productId)) await visit(next, [...path, productId])
      active.delete(productId)
      visited.add(productId)
    }
    await visit(moduleId, [])
    return {cyclePath, depth, nodes: visited.size, limitExceeded, maxDepth: limits.maxDepth, maxNodes: limits.maxNodes}
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
      .execute()
    const resolved = releases
      .filter(row => satisfiesSemverRange(row.version, versionRange))
      .sort((a, b) => compareSemver(b.version, a.version))[0]
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
    const candidates: Array<{moduleId: string; version: string; providedVersion: string}> = []
    for (const row of releases as any[]) {
      const provider = dependencyProvidesFromManifest(row.manifest).find(contract => contract.id === provides && satisfiesSemverRange(contract.version, versionRange))
      if (provider) candidates.push({moduleId: row.module_id, version: row.version, providedVersion: provider.version})
    }
    candidates.sort((a, b) => compareSemver(b.providedVersion, a.providedVersion)
      || compareSemver(b.version, a.version) || a.moduleId.localeCompare(b.moduleId))
    const resolved = candidates[0]
    return resolved ? {moduleId: resolved.moduleId, version: resolved.version} : null
  }
}
