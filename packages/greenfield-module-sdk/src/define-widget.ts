import type {GreenfieldModuleWidgetContribution} from '@modula/greenfield-module-manifest'
import {moduleContributionId} from './identifiers.js'

export function defineWidget(
  moduleId: string,
  suffix: string,
  input: Omit<GreenfieldModuleWidgetContribution, 'id' | 'widgetId'>,
): GreenfieldModuleWidgetContribution {
  const id = moduleContributionId(moduleId, `widget.${suffix}`)
  return {...input, id, widgetId: id}
}
