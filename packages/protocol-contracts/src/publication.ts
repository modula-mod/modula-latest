export type PublicationAudience = 'public' | 'followers' | 'private'

export type PublicationRecord = {
  id: string
  authorActorId: string
  audience: PublicationAudience
  createdAt: string
  text?: string
}
