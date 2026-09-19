import type {ActionRisk, Reversibility} from '@modula/intelligence-contracts'

export function classifyActionRisk(family: string): {risk: ActionRisk; reversibility: Reversibility} {
  if (family === 'financial.fixture' || family.startsWith('financial.') || family.startsWith('dimon.')) {
    return {risk: 'financial', reversibility: 'irreversible'}
  }
  if (family === 'record.query' || family === 'record.read' || family === 'module.read' || family === 'settings.read') {
    return {risk: 'read_only', reversibility: 'reversible'}
  }
  if (family === 'record.create' || family === 'record.update' || family === 'settings.update') {
    return {risk: 'write_reversible', reversibility: 'compensatable'}
  }
  if (family === 'record.delete' || family === 'record.purge') return {risk: 'write_irreversible', reversibility: 'irreversible'}
  if (family === 'connector.invoke' || family === 'share') return {risk: 'external_side_effect', reversibility: 'irreversible'}
  if (family === 'module.configure' || family === 'module.install' || family === 'function.invoke') return {risk: 'privileged', reversibility: 'compensatable'}
  return {risk: 'unknown', reversibility: 'irreversible'}
}
