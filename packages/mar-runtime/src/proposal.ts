import type {GaiaAvailableAction, ModulaActionProposal} from '@modula/intelligence-contracts'
import type {IntelligenceErrorCode} from '@modula/intelligence-contracts'

const FORBIDDEN_CAPABILITY = /^(shell|exec|eval|sql|filesystem|fs|browser|process|subprocess)(\.|$)/i
const FORBIDDEN_INPUT_KEYS = new Set(['command', 'argv', 'shell', 'sql', 'script', 'eval'])

export type ProposalRejection = {
  code: Extract<IntelligenceErrorCode, 'CAPABILITY_DENIED' | 'CAPABILITY_UNKNOWN' | 'INVALID_ACTION_SCHEMA'>
  message: string
}

export type BoundProposal = {
  proposal: ModulaActionProposal
  action: GaiaAvailableAction
}

/**
 * Bind a model proposal to a discovered capability.
 * Proposals are structured records. Shell, eval, SQL, filesystem, and process
 * dispatch strings are refused even if a catalog lists them.
 */
export function assessProposal(proposal: ModulaActionProposal, actions: readonly GaiaAvailableAction[]): BoundProposal | ProposalRejection {
  if (proposal.requestedBy !== 'gaia' || !proposal.id || !proposal.family || !proposal.capability) {
    return {code: 'INVALID_ACTION_SCHEMA', message: 'Proposal must be a GAIA action with an id, family, and capability'}
  }
  if (FORBIDDEN_CAPABILITY.test(proposal.family) || FORBIDDEN_CAPABILITY.test(proposal.capability)) {
    return {code: 'CAPABILITY_DENIED', message: 'The runtime refuses shell, eval, SQL, filesystem, browser, and process proposals'}
  }
  if (!isPlainObject(proposal.input)) {
    return {code: 'INVALID_ACTION_SCHEMA', message: 'Proposal input must be an object'}
  }
  if (Object.keys(proposal.input).some(key => FORBIDDEN_INPUT_KEYS.has(key.toLowerCase()))) {
    return {code: 'CAPABILITY_DENIED', message: 'Proposal input cannot carry a host execution field'}
  }
  const action = actions.find(candidate =>
    candidate.family === proposal.family &&
    candidate.capability === proposal.capability &&
    candidate.moduleId === proposal.moduleId,
  )
  if (!action) return {code: 'CAPABILITY_UNKNOWN', message: 'Proposal does not match a registered capability'}
  const input = {...proposal.input}
  if (action.collection) {
    if (input.collection === undefined) input.collection = action.collection
    if (input.collection !== action.collection) {
      return {code: 'INVALID_ACTION_SCHEMA', message: 'Proposal collection does not match the registered capability'}
    }
  }
  return {
    action,
    proposal: {
      ...proposal,
      input,
      requestedBy: 'gaia',
      moduleId: action.moduleId,
      family: action.family,
      capability: action.capability,
      actionId: proposal.actionId ?? action.actionId,
    },
  }
}

export function isProposalRejection(value: BoundProposal | ProposalRejection): value is ProposalRejection {
  return 'code' in value
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
