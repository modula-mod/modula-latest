import type {GreenfieldModuleAction} from '@modula/greenfield-module-ui-contracts'

export function actionRequiresForm(action: GreenfieldModuleAction): boolean {
  return ['record.create', 'record.update', 'settings.update', 'function.invoke'].includes(action.kind)
}

export function primaryActionFor(actions: GreenfieldModuleAction[] | undefined, kind: GreenfieldModuleAction['kind']) {
  return (actions ?? []).find(action => action.kind === kind)
}
