import {keepPreviousData, useMutation, useQuery, useQueryClient} from '@tanstack/react-query'

import {useSession} from '@/auth/runtime'
import type {ProductHubCategory} from '@/data/repositories/contracts'
import {useAppServices} from '@/runtime/useAppServices'
import {moduleQueryKeys} from '@/features/modules/state/moduleQueryKeys'

export function useModuleCatalogueQuery(input: {q?: string; category?: ProductHubCategory} = {}) {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  const viewer = session.status === 'signedIn' ? 'signedIn' : 'public'
  return useQuery({
    queryKey: moduleQueryKeys.catalogue(input, viewer),
    queryFn: () => moduleRepository.listCatalogue(input, {includeInstalled: viewer === 'signedIn'}),
    placeholderData: keepPreviousData,
  })
}

export function useInstalledModulesQuery() {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  return useQuery({
    queryKey: moduleQueryKeys.installed,
    enabled: session.status === 'signedIn',
    queryFn: () => moduleRepository.listInstalled(),
  })
}

export function useModuleDetailQuery(moduleId: string) {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  const viewer = session.status === 'signedIn' ? 'signedIn' : 'public'
  return useQuery({
    queryKey: moduleQueryKeys.detail(moduleId, viewer),
    queryFn: () => moduleRepository.getModule(moduleId, {includeInstalled: viewer === 'signedIn'}),
    enabled: Boolean(moduleId),
  })
}

export function useModuleRelationshipsQuery(moduleId: string) {
  const {moduleRepository} = useAppServices()
  return useQuery({
    queryKey: moduleQueryKeys.relationships(moduleId),
    queryFn: () => moduleRepository.getProductRelationships(moduleId),
    enabled: Boolean(moduleId),
  })
}

export function useModuleHostCompositionQuery(moduleId: string, route?: string, platform = 'web') {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  return useQuery({
    queryKey: moduleQueryKeys.composition(moduleId, route, platform),
    queryFn: () => moduleRepository.getHostComposition(moduleId, {platform, route}),
    enabled: Boolean(moduleId) && session.status === 'signedIn',
  })
}

export function useModuleViewsQuery(moduleId: string) {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  return useQuery({
    queryKey: moduleQueryKeys.views(moduleId),
    queryFn: () => moduleRepository.listViews(moduleId),
    enabled: Boolean(moduleId) && session.status === 'signedIn',
  })
}

export function useModuleRecordsQuery(
  moduleId: string,
  collection: string,
  input: {q?: string; folder?: string; sort?: string; direction?: 'asc' | 'desc'} = {},
) {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  return useQuery({
    queryKey: moduleQueryKeys.records(moduleId, collection, input),
    queryFn: () => moduleRepository.listRecords(moduleId, collection, input),
    enabled: Boolean(moduleId && collection) && session.status === 'signedIn',
  })
}

export function useModuleSettingsQuery(moduleId: string) {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  return useQuery({
    queryKey: moduleQueryKeys.settings(moduleId),
    queryFn: () => moduleRepository.getSettings(moduleId),
    enabled: Boolean(moduleId) && session.status === 'signedIn',
  })
}

export function useModuleSettingsSchemaQuery(moduleId: string) {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  return useQuery({
    queryKey: moduleQueryKeys.settingsSchema(moduleId),
    queryFn: () => moduleRepository.getSettingsSchema(moduleId),
    enabled: Boolean(moduleId) && session.status === 'signedIn',
  })
}

export function useModuleHealthQuery(moduleId: string) {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  return useQuery({
    queryKey: moduleQueryKeys.health(moduleId),
    queryFn: () => moduleRepository.getHealth(moduleId),
    enabled: Boolean(moduleId) && session.status === 'signedIn',
  })
}

export function useModuleRuntimeQuery(moduleId: string) {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  return useQuery({
    queryKey: moduleQueryKeys.runtime(moduleId),
    queryFn: () => moduleRepository.getRuntimeSummary(moduleId),
    enabled: Boolean(moduleId) && session.status === 'signedIn',
  })
}

export function useModuleBackendDiagnosticsQuery(moduleId: string) {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  return useQuery({
    queryKey: moduleQueryKeys.backend(moduleId),
    queryFn: () => moduleRepository.getBackendDiagnostics(moduleId),
    enabled: Boolean(moduleId) && session.status === 'signedIn',
  })
}

export function useModuleContributionQuery(input: {surface?: string; moduleId?: string; enabledOnly?: boolean} = {}) {
  const {moduleRepository} = useAppServices()
  const session = useSession()
  return useQuery({
    queryKey: moduleQueryKeys.contributions(input),
    enabled: session.status === 'signedIn',
    queryFn: () => moduleRepository.listContributions(input),
  })
}

export function useModuleLifecycleMutations(moduleId: string) {
  const {moduleRepository} = useAppServices()
  const queryClient = useQueryClient()
  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({queryKey: moduleQueryKeys.installed}),
      queryClient.invalidateQueries({queryKey: moduleQueryKeys.detail(moduleId)}),
      queryClient.invalidateQueries({queryKey: moduleQueryKeys.runtime(moduleId)}),
      queryClient.invalidateQueries({queryKey: moduleQueryKeys.backend(moduleId)}),
      queryClient.invalidateQueries({queryKey: moduleQueryKeys.catalogueRoot}),
    ])
  }
  return {
    install: useMutation({mutationFn: () => moduleRepository.install(moduleId), onSuccess: invalidate}),
    enable: useMutation({mutationFn: () => moduleRepository.enable(moduleId), onSuccess: invalidate}),
    disable: useMutation({mutationFn: () => moduleRepository.disable(moduleId), onSuccess: invalidate}),
    update: useMutation({mutationFn: () => moduleRepository.update(moduleId), onSuccess: invalidate}),
    uninstall: useMutation({mutationFn: () => moduleRepository.uninstall(moduleId, 'keepData'), onSuccess: invalidate}),
  }
}

export function useModuleRecordMutations(moduleId: string, collection: string) {
  const {moduleRepository} = useAppServices()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({queryKey: moduleQueryKeys.recordsCollection(moduleId, collection)})
  return {
    create: useMutation({mutationFn: (data: Record<string, unknown>) => moduleRepository.createRecord(moduleId, collection, data), onSuccess: invalidate}),
    update: useMutation({
      mutationFn: (input: {recordId: string; data: Record<string, unknown>; expectedRevision?: number}) =>
        moduleRepository.updateRecord(moduleId, collection, input.recordId, input.data, input.expectedRevision),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (input: {recordId: string; expectedRevision?: number}) =>
        moduleRepository.deleteRecord(moduleId, collection, input.recordId, input.expectedRevision),
      onSuccess: invalidate,
    }),
  }
}

export function useModuleAIMutations(moduleId: string, collection: string) {
  const {moduleRepository} = useAppServices()
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({queryKey: moduleQueryKeys.recordsCollection(moduleId, collection)})
  return {
    execute: useMutation({
      mutationFn: (input: {actionId: string; recordId: string; expectedRevision: number; selection?: {blockIds?: string[]; text?: string}; variables?: Record<string, unknown>; streaming?: boolean}) =>
        moduleRepository.executeAIAction(moduleId, input.actionId, {
          recordId: input.recordId,
          expectedRevision: input.expectedRevision,
          selection: input.selection,
          variables: input.variables,
          streaming: input.streaming,
        }),
    }),
    apply: useMutation({
      mutationFn: (input: {executionId: string; recordId: string; expectedRevision: number; selectedResult?: Record<string, unknown>}) =>
        moduleRepository.applyAIExecution(moduleId, input.executionId, {
          recordId: input.recordId,
          expectedRevision: input.expectedRevision,
          selectedResult: input.selectedResult,
        }),
      onSuccess: invalidate,
    }),
  }
}
