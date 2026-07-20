export type Task = {
  id: number
  title: string
  description: string
  emoji: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
  dueDate: Date
  createdAt: Date
}

export type UserProfile = {
  name: string
  username: string
  avatar: string
  theme: string
  profileImageSize: 'small' | 'medium' | 'large'
}

export type AppSettings = {
  notifications: boolean
  autoSave: boolean
  theme: 'light' | 'dark' | 'auto'
  language: string
}

export type LabState = {
  profile: UserProfile
  updateProfile: (updates: Partial<UserProfile>) => void
  tasks: Task[]
  toggleTask: (id: number) => void
  settings: AppSettings
  updateSettings: (updates: Partial<AppSettings>) => void
  selectedDate: Date
  setSelectedDate: (date: Date) => void
  taskFilter: 'all' | 'pending' | 'completed'
  setTaskFilter: (filter: 'all' | 'pending' | 'completed') => void
  productivityScore: number
  setProductivityScore: (score: number) => void
  focusLevel: number
  setFocusLevel: (level: number) => void
  contextMenuStates: Record<string, boolean>
  updateContextMenuState: (key: string, value: boolean) => void
}

export type ExpoUiLabSectionId =
  | 'buttons'
  | 'profile'
  | 'dashboard'
  | 'tasks'
  | 'context-menu'
  | 'date-time'
  | 'settings'

export type ExpoUiLabSectionMeta = {
  id: ExpoUiLabSectionId
  title: string
  summary: string
  /** Expo UI primitives exercised in this section. */
  expoComponents: string[]
  /** Existing Modula wrappers to prefer in product code. */
  modulaWrappers: string[]
  /** Product surfaces where this pattern is a candidate. */
  suggestedContexts: string[]
  /** Adoption readiness for Modula product screens. */
  status: 'wrapped' | 'candidate' | 'explore'
}
