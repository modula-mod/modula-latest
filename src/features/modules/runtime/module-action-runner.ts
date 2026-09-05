import type {GreenfieldModuleAction, GreenfieldModuleView} from '@modula/greenfield-module-ui-contracts'

type RuntimeActionView = Pick<GreenfieldModuleView, 'collection' | 'query' | 'toolbar'> & {
  allowedActions?: GreenfieldModuleAction[]
}

export function actionRequiresForm(action: GreenfieldModuleAction): boolean {
  return ['record.create', 'record.update', 'settings.update', 'function.invoke'].includes(action.kind)
}

export function primaryActionFor(actions: GreenfieldModuleAction[] | undefined, kind: GreenfieldModuleAction['kind']) {
  return (actions ?? []).find(action => action.kind === kind)
}

export function mutationCollectionFor(view: RuntimeActionView): string {
  const actions = view.allowedActions ?? view.toolbar ?? []
  const mutationAction = actions.find(action =>
    ['record.create', 'record.update', 'record.delete', 'record.restore', 'record.purge'].includes(action.kind)
    && Boolean(action.target?.collection),
  )
  return view.collection || view.query?.collection || mutationAction?.target?.collection || ''
}
