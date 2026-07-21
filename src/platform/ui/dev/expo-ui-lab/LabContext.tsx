import {
  createContext,
  use,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

import type {
  AppSettings,
  LabState,
  Task,
  UserProfile,
} from '@/platform/ui/dev/expo-ui-lab/types'

const LabContext = createContext<LabState | null>(null)

const initialTasks: Task[] = [
  {
    id: 1,
    title: 'Complete project proposal',
    description: 'Finish the Q1 proposal for the Modula design system',
    emoji: '📋',
    completed: false,
    priority: 'high',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
  {
    id: 2,
    title: 'Review UI components',
    description: 'Evaluate Expo UI candidates in Developer → Expo UI Lab',
    emoji: '🎨',
    completed: true,
    priority: 'medium',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
  },
  {
    id: 3,
    title: 'Update documentation',
    description: 'Note which wrappers should absorb playground patterns',
    emoji: '📚',
    completed: false,
    priority: 'low',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3),
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 12),
  },
  {
    id: 4,
    title: 'Team standup meeting',
    description: 'Weekly planning for component adoption',
    emoji: '👥',
    completed: false,
    priority: 'medium',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 8),
    createdAt: new Date(),
  },
]

const initialProfile: UserProfile = {
  name: 'Modula Dev',
  username: '@modula',
  avatar: 'person.fill',
  theme: '#369CAA',
  profileImageSize: 'medium',
}

const initialSettings: AppSettings = {
  notifications: true,
  autoSave: true,
  theme: 'auto',
  language: 'en',
}

const initialContextMenuStates = {
  'Show Completed Tasks': true,
  'Auto Refresh': false,
  Notifications: true,
  'Dark Mode': false,
}

export function ExpoUiLabProvider({children}: {children: ReactNode}) {
  const [profile, setProfile] = useState(initialProfile)
  const [tasks, setTasks] = useState(initialTasks)
  const [settings, setSettings] = useState(initialSettings)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [taskFilter, setTaskFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [productivityScore, setProductivityScore] = useState(0.75)
  const [focusLevel, setFocusLevel] = useState(0.6)
  const [contextMenuStates, setContextMenuStates] = useState(initialContextMenuStates)

  const value = useMemo<LabState>(
    () => ({
      profile,
      updateProfile: updates => setProfile(prev => ({...prev, ...updates})),
      tasks,
      toggleTask: id =>
        setTasks(prev =>
          prev.map(task =>
            task.id === id ? {...task, completed: !task.completed} : task,
          ),
        ),
      settings,
      updateSettings: updates => setSettings(prev => ({...prev, ...updates})),
      selectedDate,
      setSelectedDate,
      taskFilter,
      setTaskFilter,
      productivityScore,
      setProductivityScore,
      focusLevel,
      setFocusLevel,
      contextMenuStates,
      updateContextMenuState: (key, next) =>
        setContextMenuStates(prev => ({...prev, [key]: next})),
    }),
    [
      profile,
      tasks,
      settings,
      selectedDate,
      taskFilter,
      productivityScore,
      focusLevel,
      contextMenuStates,
    ],
  )

  return <LabContext.Provider value={value}>{children}</LabContext.Provider>
}

export function useExpoUiLab(): LabState {
  const state = use(LabContext)
  if (!state) {
    throw new Error('useExpoUiLab must be used inside ExpoUiLabProvider')
  }
  return state
}
