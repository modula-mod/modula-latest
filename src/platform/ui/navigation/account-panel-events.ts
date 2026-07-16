import type {PanelState} from '@/platform/ui/navigation/account-panel-state'

export type AccountPanelDevEventName =
  | 'accountPanel.open.request'
  | 'accountPanel.opening'
  | 'accountPanel.open'
  | 'accountPanel.backdrop.press'
  | 'accountPanel.dismiss.request'
  | 'accountPanel.closing'
  | 'accountPanel.closed'
  | 'accountPanel.route.changed'

export type AccountPanelDevEvent = {
  name: AccountPanelDevEventName
  at: number
  state: PanelState['status']
  source?: string
  route?: string
}

const MAX_EVENTS = 40
const buffer: AccountPanelDevEvent[] = []

/** __DEV__-only instrumentation for instant-close diagnosis. */
export function emitAccountPanelEvent(
  name: AccountPanelDevEventName,
  state: PanelState,
  extras?: {source?: string; route?: string},
): void {
  if (!__DEV__) return

  const event: AccountPanelDevEvent = {
    name,
    at: Date.now(),
    state: state.status,
    source: extras?.source,
    route: extras?.route,
  }
  buffer.push(event)
  if (buffer.length > MAX_EVENTS) {
    buffer.shift()
  }
  console.debug('[accountPanel]', event.name, {
    state: event.state,
    source: event.source,
    route: event.route,
    at: event.at,
  })
}

export function getAccountPanelEventBuffer(): readonly AccountPanelDevEvent[] {
  return buffer
}

export function clearAccountPanelEventBuffer(): void {
  buffer.length = 0
}
