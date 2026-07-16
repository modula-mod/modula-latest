import type {ModulaProfile, UpdateProfileInput} from '@/features/profile/contracts'

export interface ProfileRepository {
  getProfileByHandle(handle: string): Promise<ModulaProfile>
  updateOwnerProfile(input: UpdateProfileInput): Promise<ModulaProfile>
}
