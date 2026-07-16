import {createContext} from 'react'

import type {ProfileTabRegistry} from '@/features/profile/contracts/profileTabs'

export const ProfileRegistryContext = createContext<ProfileTabRegistry | null>(null)
