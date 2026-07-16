export type FocusStatusId =
  | 'available'
  | 'focused'
  | 'busy'
  | 'away'
  | 'doNotDisturb'
  | 'live'
  | 'private'

export type FocusStatus = {
  id: FocusStatusId
  label: string
  message?: string
  updatedAt: string
}

export const FOCUS_STATUS_OPTIONS: FocusStatus[] = [
  {
    id: 'available',
    label: 'Available',
    message: 'Open to collaborate',
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'focused',
    label: 'Focused',
    message: 'Building in focus mode',
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'busy',
    label: 'Busy',
    message: 'Limited responses',
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'away',
    label: 'Away',
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'doNotDisturb',
    label: 'Do Not Disturb',
    message: 'Notifications muted',
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'live',
    label: 'Live',
    message: 'Sharing publicly',
    updatedAt: new Date(0).toISOString(),
  },
  {
    id: 'private',
    label: 'Private',
    message: 'Presence hidden',
    updatedAt: new Date(0).toISOString(),
  },
]
