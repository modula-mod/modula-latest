import type {
  ModuleStandard20ConflictRef,
  ModuleStandard20DependencyGraph,
  ModuleStandard20DependencyRef,
  ModuleStandard20ProvideRef,
} from '@modula/module-standard'
import {MODULA_MODULE_STANDARD_2_VERSION} from '@modula/module-standard'
import type {GreenfieldModuleManifest} from './manifest.js'

export type GreenfieldModuleDependency = {
  moduleId: string
  versionRange: string
  optional: boolean
  reason?: string
}

export type GreenfieldModuleDependencyGraph = ModuleStandard20DependencyGraph
export type GreenfieldModuleDependencyRelation = 'requires' | 'optional' | 'recommended' | 'conflicts' | 'replaces'

export type GreenfieldModuleDependencyRequest = {
  relation: GreenfieldModuleDependencyRelation
  moduleId: string | null
  provides: string | null
  versionRange: string
  optional: boolean
  blocking: boolean
  reason?: string
}

export type GreenfieldDependencyRelease = {
  moduleId: string
  version: string
  status: 'published' | 'verified' | 'draft' | 'pendingReview' | 'quarantined' | 'revoked' | 'superseded'
  compatible: boolean
}

export type GreenfieldResolvedDependency = {
  moduleId: string
  requestedRange: string
  resolvedVersion: string | null
  installed: boolean
  optional: boolean
}

export type GreenfieldDependencyResolutionPlan = {
  dependencies: GreenfieldResolvedDependency[]
  installable: boolean
  errors: string[]
}

export function dependencyGraphFromManifest(manifest: GreenfieldModuleManifest): GreenfieldModuleDependencyGraph {
  const graph = 'dependencyGraph' in manifest ? manifest.dependencyGraph : undefined
  if (graph) return graph
  return {
    version: MODULA_MODULE_STANDARD_2_VERSION,
    requires: legacyDependenciesForGraph(manifest.dependencies?.filter(dependency => !dependency.optional) ?? []),
    optional: legacyDependenciesForGraph(manifest.dependencies?.filter(dependency => dependency.optional) ?? []),
    recommended: [],
    conflicts: [],
    replaces: [],
    provides: [],
  }
}

export function dependencyRequestsFromManifest(manifest: GreenfieldModuleManifest): GreenfieldModuleDependencyRequest[] {
  const graph = dependencyGraphFromManifest(manifest)
  return [
    ...dependencyRefsToRequests('requires', graph.requires ?? []),
    ...dependencyRefsToRequests('optional', graph.optional ?? []),
    ...dependencyRefsToRequests('recommended', graph.recommended ?? []),
    ...conflictRefsToRequests('conflicts', graph.conflicts ?? []),
    ...conflictRefsToRequests('replaces', graph.replaces ?? []),
  ]
}

export function dependencyProvidesFromManifest(manifest: GreenfieldModuleManifest): ModuleStandard20ProvideRef[] {
  return dependencyGraphFromManifest(manifest).provides ?? []
}

function legacyDependenciesForGraph(dependencies: GreenfieldModuleDependency[]): ModuleStandard20DependencyRef[] {
  return dependencies.map(dependency => ({
    moduleId: dependency.moduleId,
    versionRange: dependency.versionRange,
    reason: dependency.reason,
  }))
}

function dependencyRefsToRequests(
  relation: Extract<GreenfieldModuleDependencyRelation, 'requires' | 'optional' | 'recommended'>,
  refs: ModuleStandard20DependencyRef[],
): GreenfieldModuleDependencyRequest[] {
  return refs.map(ref => ({
    relation,
    moduleId: ref.moduleId ?? null,
    provides: ref.provides ?? null,
    versionRange: ref.versionRange,
    optional: relation !== 'requires',
    blocking: relation === 'requires',
    reason: ref.reason,
  }))
}

function conflictRefsToRequests(
  relation: Extract<GreenfieldModuleDependencyRelation, 'conflicts' | 'replaces'>,
  refs: ModuleStandard20ConflictRef[],
): GreenfieldModuleDependencyRequest[] {
  return refs.map(ref => ({
    relation,
    moduleId: ref.moduleId,
    provides: null,
    versionRange: ref.versionRange ?? '*',
    optional: true,
    blocking: relation === 'conflicts',
    reason: ref.reason,
  }))
}
