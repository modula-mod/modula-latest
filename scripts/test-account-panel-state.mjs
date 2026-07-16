import assert from 'node:assert/strict'

/** Mirrors src/platform/ui/navigation/account-panel-state.ts for pure transition tests. */
function accountPanelReducer(state, action) {
  switch (action.type) {
    case 'OPEN_REQUEST': {
      if (state.status === 'open' || state.status === 'opening') return state
      return {status: 'opening', openedAt: action.at}
    }
    case 'OPEN_COMPLETE': {
      if (state.status !== 'opening') return state
      return {status: 'open', openedAt: state.openedAt}
    }
    case 'CLOSE_REQUEST': {
      if (state.status === 'closed' || state.status === 'closing') return state
      return {status: 'closing', reason: action.reason}
    }
    case 'PRESENTATION_DISMISSED': {
      if (state.status === 'closed' || state.status === 'closing') {
        return state.status === 'closing' ? state : {status: 'closed'}
      }
      return {status: 'closing', reason: action.reason ?? 'swipe'}
    }
    case 'ROUTE_NAVIGATED': {
      if (state.status === 'closed' || state.status === 'closing') return state
      return {status: 'closing', reason: 'route'}
    }
    case 'CLOSE_COMPLETE':
    case 'RESET':
      return {status: 'closed'}
    default:
      return state
  }
}

const initial = {status: 'closed'}
const reduce = actions => actions.reduce(accountPanelReducer, initial)

assert.equal(reduce([{type: 'OPEN_REQUEST', at: 1}, {type: 'OPEN_COMPLETE'}]).status, 'open')

assert.equal(
  reduce([
    {type: 'OPEN_REQUEST', at: 1},
    {type: 'OPEN_COMPLETE'},
    {type: 'CLOSE_REQUEST', reason: 'explicit'},
    {type: 'CLOSE_COMPLETE'},
  ]).status,
  'closed',
)

{
  const state = reduce([{type: 'OPEN_REQUEST', at: 1}, {type: 'OPEN_REQUEST', at: 2}])
  assert.equal(state.status, 'opening')
  assert.equal(state.openedAt, 1)
}

{
  const state = reduce([
    {type: 'OPEN_REQUEST', at: 1},
    {type: 'OPEN_COMPLETE'},
    {type: 'CLOSE_REQUEST', reason: 'explicit'},
    {type: 'CLOSE_REQUEST', reason: 'backdrop'},
  ])
  assert.equal(state.status, 'closing')
  assert.equal(state.reason, 'explicit')
}

assert.equal(
  reduce([
    {type: 'OPEN_REQUEST', at: 1},
    {type: 'PRESENTATION_DISMISSED', reason: 'swipe'},
    {type: 'CLOSE_COMPLETE'},
  ]).status,
  'closed',
)

{
  const state = reduce([
    {type: 'OPEN_REQUEST', at: 1},
    {type: 'OPEN_COMPLETE'},
    {type: 'ROUTE_NAVIGATED'},
    {type: 'ROUTE_NAVIGATED'},
  ])
  assert.equal(state.status, 'closing')
  assert.equal(state.reason, 'route')
}

assert.equal(
  reduce([
    {type: 'OPEN_REQUEST', at: 1},
    {type: 'OPEN_COMPLETE'},
    {type: 'CLOSE_REQUEST', reason: 'backdrop'},
    {type: 'CLOSE_REQUEST', reason: 'backdrop'},
  ]).status,
  'closing',
)

assert.equal(
  reduce([
    {type: 'OPEN_REQUEST', at: 1},
    {type: 'OPEN_COMPLETE'},
    {type: 'OPEN_REQUEST', at: 9},
  ]).status,
  'open',
)

assert.equal(
  reduce([
    {type: 'OPEN_REQUEST', at: 1},
    {type: 'OPEN_COMPLETE'},
    {type: 'RESET'},
  ]).status,
  'closed',
)

console.log('account-panel-state tests passed')
