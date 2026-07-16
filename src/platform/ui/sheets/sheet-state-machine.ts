export type SheetStatus = 'closed' | 'opening' | 'open' | 'closing'

export type SheetCloseReason =
  | 'explicit'
  | 'swipe'
  | 'backdrop'
  | 'route'
  | 'session'
  | 'reset'

export type SheetState =
  | {status: 'closed'}
  | {status: 'opening'; openedAt: number}
  | {status: 'open'; openedAt: number}
  | {status: 'closing'; reason: SheetCloseReason}

export type SheetAction =
  | {type: 'OPEN_REQUEST'; at: number}
  | {type: 'OPEN_COMPLETE'}
  | {type: 'CLOSE_REQUEST'; reason: SheetCloseReason}
  | {type: 'CLOSE_COMPLETE'}
  | {type: 'PRESENTATION_DISMISSED'; reason?: SheetCloseReason}
  | {type: 'ROUTE_NAVIGATED'}
  | {type: 'RESET'}

export const initialSheetState: SheetState = {status: 'closed'}

export function sheetReducer(state: SheetState, action: SheetAction): SheetState {
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
      if (state.status === 'closed' || state.status === 'closing') {
        return state.status === 'closing' ? state : {status: 'closed'}
      }
      return {
        status: 'closing',
        reason: action.reason ?? 'swipe',
      }
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

export function isSheetVisible(state: SheetState): boolean {
  return state.status === 'opening' || state.status === 'open'
}
