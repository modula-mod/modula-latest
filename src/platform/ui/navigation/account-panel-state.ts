export type PanelCloseReason =
  | 'explicit'
  | 'swipe'
  | 'backdrop'
  | 'route'
  | 'session'
  | 'reset'

export type PanelState =
  | {status: 'closed'}
  | {status: 'opening'; openedAt: number}
  | {status: 'open'; openedAt: number}
  | {status: 'closing'; reason: PanelCloseReason}

export type PanelAction =
  | {type: 'OPEN_REQUEST'; at: number; source?: string}
  | {type: 'OPEN_COMPLETE'}
  | {type: 'CLOSE_REQUEST'; reason: PanelCloseReason}
  | {type: 'CLOSE_COMPLETE'}
  | {type: 'PRESENTATION_DISMISSED'; reason?: PanelCloseReason}
  | {type: 'ROUTE_NAVIGATED'}
  | {type: 'RESET'}

export const initialPanelState: PanelState = {status: 'closed'}

export function accountPanelReducer(
  state: PanelState,
  action: PanelAction,
): PanelState {
  switch (action.type) {
    case 'OPEN_REQUEST': {
      if (state.status === 'open' || state.status === 'opening') {
        return state
      }
      return {status: 'opening', openedAt: action.at}
    }
    case 'OPEN_COMPLETE': {
      if (state.status !== 'opening') {
        return state
      }
      return {status: 'open', openedAt: state.openedAt}
    }
    case 'CLOSE_REQUEST': {
      if (state.status === 'closed' || state.status === 'closing') {
        return state
      }
      return {status: 'closing', reason: action.reason}
    }
    case 'PRESENTATION_DISMISSED': {
      if (state.status === 'closed') {
        return state
      }
      if (state.status === 'closing') {
        return state
      }
      return {status: 'closing', reason: action.reason ?? 'swipe'}
    }
    case 'ROUTE_NAVIGATED': {
      if (state.status === 'closed' || state.status === 'closing') {
        return state
      }
      return {status: 'closing', reason: 'route'}
    }
    case 'CLOSE_COMPLETE':
    case 'RESET':
      return {status: 'closed'}
    default:
      return state
  }
}

export function isAccountPanelVisible(state: PanelState): boolean {
  return state.status === 'opening' || state.status === 'open'
}
