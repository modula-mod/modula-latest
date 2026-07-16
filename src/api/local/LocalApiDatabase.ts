import {parseAccountId, parsePostId, parseProfileId, parseSessionId, type AccountId, type PostId, type ProfileId, type SessionId} from '@/api/contracts/identifiers'
import type {CursorPage} from '@/api/contracts'
import type {AuthResult, RefreshToken} from '@/auth/contracts'
import type {ModulaAccount} from '@/domain/account'
import type {ActivityItem} from '@/domain/activity'
import type {DiscoverResult, ReelItem} from '@/domain/discovery'
import type {ConnectionListInput, CreatePostInput, FeedMode, FollowResult, PostEngagement, SocialPost} from '@/domain/social'
import type {ModulaProfile, UpdateProfileInput} from '@/features/profile/contracts'
import {LocalApiClock} from '@/api/local/LocalApiClock'
import {LocalTokenIssuer} from '@/api/local/LocalTokenIssuer'

export type LocalAccountRecord = ModulaAccount & {
  approvedDemo: boolean
}
export type LocalProfileRecord = ModulaProfile & {
  accountId: AccountId | null
}
export type LocalPostRecord = SocialPost
export type LocalFollowRecord = {followerProfileId: ProfileId; followingProfileId: ProfileId}
export type LocalLikeRecord = {profileId: ProfileId; postId: PostId}
export type LocalSaveRecord = {profileId: ProfileId; postId: PostId}
export type LocalRepostRecord = {profileId: ProfileId; postId: PostId}
export type LocalActivityRecord = ActivityItem
export type LocalSessionRecord = {
  id: SessionId
  accountId: AccountId
  accessToken: string
  refreshToken: RefreshToken
  accessTokenExpiresAt: string
  refreshTokenExpiresAt: string
  revoked: boolean
}

export type LocalApiDatabaseState = {
  accounts: LocalAccountRecord[]
  profiles: LocalProfileRecord[]
  posts: LocalPostRecord[]
  follows: LocalFollowRecord[]
  likes: LocalLikeRecord[]
  saves: LocalSaveRecord[]
  reposts: LocalRepostRecord[]
  activity: LocalActivityRecord[]
  sessions: LocalSessionRecord[]
  discover: DiscoverResult
  reels: ReelItem[]
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function encodeCursor(index: number): string {
  return `cursor_${index.toString(36)}_${(index * 17 + 29).toString(36)}`
}

function decodeCursor(cursor: string | null | undefined): number {
  if (!cursor) return 0
  const match = /^cursor_([a-z0-9]+)_/.exec(cursor)
  return match ? Number.parseInt(match[1], 36) : 0
}

function pageItems<T>(items: T[], cursor?: string | null, limit = 8): CursorPage<T> {
  const start = decodeCursor(cursor)
  const selected = items.slice(start, start + limit)
  const nextIndex = start + selected.length
  return {
    items: clone(selected),
    nextCursor: nextIndex < items.length ? encodeCursor(nextIndex) : null,
    hasMore: nextIndex < items.length,
  }
}

export class LocalApiDatabase {
  private state: LocalApiDatabaseState
  private idempotentPosts = new Map<string, PostId>()
  private tokenIssuer: LocalTokenIssuer

  constructor(
    seed: LocalApiDatabaseState,
    private readonly clock = new LocalApiClock(),
  ) {
    this.state = clone(seed)
    this.tokenIssuer = new LocalTokenIssuer(clock)
  }

  reset(seed: LocalApiDatabaseState) {
    this.state = clone(seed)
    this.idempotentPosts.clear()
    this.tokenIssuer = new LocalTokenIssuer(this.clock)
  }

  snapshot(): LocalApiDatabaseState {
    return clone(this.state)
  }

  getProfileById(profileId: ProfileId): ModulaProfile | null {
    const profile = this.state.profiles.find(item => item.id === profileId)
    return profile ? this.withRelationship(profile) : null
  }

  getProfileByHandle(handle: string): ModulaProfile | null {
    const profile = this.state.profiles.find(item => item.handle === handle)
    return profile ? this.withRelationship(profile) : null
  }

  getOwnerProfile(accountId: AccountId): ModulaProfile {
    const profile = this.state.profiles.find(item => item.accountId === accountId)
    if (!profile) throw new Error('Owner profile not found.')
    return this.withRelationship(profile)
  }

  listFeed(input: {mode: FeedMode; cursor?: string | null; limit?: number}): CursorPage<SocialPost> {
    const owner = this.ownerProfileId()
    const followed = new Set(
      this.state.follows
        .filter(follow => follow.followerProfileId === owner)
        .map(follow => follow.followingProfileId),
    )
    const posts = this.state.posts.filter(post => {
      if (input.mode === 'following') return post.author.id === owner || followed.has(post.author.id as ProfileId)
      return post.feed === input.mode
    })
    return pageItems(this.decoratePosts(posts), input.cursor, input.limit)
  }

  listProfilePosts(input: {profileId: ProfileId; cursor?: string | null; limit?: number}): CursorPage<SocialPost> {
    return pageItems(
      this.decoratePosts(this.state.posts.filter(post => post.author.id === input.profileId)),
      input.cursor,
      input.limit,
    )
  }

  listSavedPosts(input: {cursor?: string | null; limit?: number}): CursorPage<SocialPost> {
    const owner = this.ownerProfileId()
    const saved = new Set(this.state.saves.filter(item => item.profileId === owner).map(item => item.postId))
    return pageItems(this.decoratePosts(this.state.posts.filter(post => saved.has(post.id))), input.cursor, input.limit)
  }

  getPost(postId: PostId): SocialPost | null {
    const post = this.state.posts.find(item => item.id === postId)
    return post ? this.decoratePost(post) : null
  }

  createPost(input: CreatePostInput): SocialPost {
    const existingId = this.idempotentPosts.get(input.idempotencyKey)
    if (existingId) {
      const existing = this.getPost(existingId)
      if (existing) return existing
    }
    const owner = this.getOwnerProfile(parseAccountId('account-andrei'))
    const post: SocialPost = input.media.length
      ? {
          id: parsePostId(`post-local-${Date.now()}`),
          kind: 'media',
          author: owner,
          createdAt: this.clock.iso(),
          feed: 'following',
          text: input.text.trim(),
          media: input.media.map(item => ({
            id: item.localId,
            kind: 'image',
            url: item.localUri,
            width: item.width,
            height: item.height,
            aspectRatio: item.width && item.height ? item.width / item.height : 4 / 5,
            title: 'Selected local photo',
            colour: owner.coverColour,
          })),
          pendingMedia: input.media,
          glowColour: owner.coverColour ?? '#369CAA',
          liked: false,
          saved: false,
          reposted: false,
          likeCount: 0,
          replyCount: 0,
          repostCount: 0,
        }
      : input.linkPreview
        ? {
            id: parsePostId(`post-local-${Date.now()}`),
            kind: 'link',
            author: owner,
            createdAt: this.clock.iso(),
            feed: 'following',
            text: input.text.trim(),
            link: input.linkPreview,
            liked: false,
            saved: false,
            reposted: false,
            likeCount: 0,
            replyCount: 0,
            repostCount: 0,
          }
        : {
            id: parsePostId(`post-local-${Date.now()}`),
            kind: 'text',
            author: owner,
            createdAt: this.clock.iso(),
            feed: 'following',
            text: input.text.trim() || 'Shared a local Modula update.',
            liked: false,
            saved: false,
            reposted: false,
            likeCount: 0,
            replyCount: 0,
            repostCount: 0,
          }
    this.state.posts = [post, ...this.state.posts]
    this.idempotentPosts.set(input.idempotencyKey, post.id)
    return this.decoratePost(post)
  }

  toggleLike(postId: PostId, liked: boolean): PostEngagement {
    this.toggleEdge('likes', postId, liked)
    return this.updatePostEngagement(postId)
  }

  toggleSave(postId: PostId, saved: boolean): PostEngagement {
    this.toggleEdge('saves', postId, saved)
    return this.updatePostEngagement(postId)
  }

  toggleRepost(postId: PostId, reposted: boolean): PostEngagement {
    this.toggleEdge('reposts', postId, reposted)
    return this.updatePostEngagement(postId)
  }

  followProfile(profileId: ProfileId): FollowResult {
    const owner = this.ownerProfileId()
    if (!this.state.follows.some(item => item.followerProfileId === owner && item.followingProfileId === profileId)) {
      this.state.follows.push({followerProfileId: owner, followingProfileId: profileId})
    }
    return this.updateProfileFollowState(profileId)
  }

  unfollowProfile(profileId: ProfileId): FollowResult {
    const owner = this.ownerProfileId()
    this.state.follows = this.state.follows.filter(item =>
      !(item.followerProfileId === owner && item.followingProfileId === profileId),
    )
    return this.updateProfileFollowState(profileId)
  }

  listFollowers(input: ConnectionListInput): CursorPage<ModulaProfile> {
    const profile = this.getProfileByHandle(input.handle)
    if (!profile) return pageItems([], input.cursor, input.limit)
    const ids = this.state.follows
      .filter(item => item.followingProfileId === profile.id)
      .map(item => item.followerProfileId)
    return pageItems(ids.map(id => this.getProfileById(id)).filter(Boolean) as ModulaProfile[], input.cursor, input.limit)
  }

  listFollowing(input: ConnectionListInput): CursorPage<ModulaProfile> {
    const profile = this.getProfileByHandle(input.handle)
    if (!profile) return pageItems([], input.cursor, input.limit)
    const ids = this.state.follows
      .filter(item => item.followerProfileId === profile.id)
      .map(item => item.followingProfileId)
    return pageItems(ids.map(id => this.getProfileById(id)).filter(Boolean) as ModulaProfile[], input.cursor, input.limit)
  }

  listActivity(input: {cursor?: string | null; limit?: number}): CursorPage<ActivityItem> {
    return pageItems(this.state.activity, input.cursor, input.limit)
  }

  getDiscover(): DiscoverResult {
    return clone(this.state.discover)
  }

  getReels(): ReelItem[] {
    return clone(this.state.reels)
  }

  createSession(input: {email: string; displayName?: string}): AuthResult {
    const account = this.state.accounts.find(item => item.email === input.email)
    if (!account) throw new Error('Account not found.')
    return this.createSessionForAccount(account)
  }

  register(input: {email: string; displayName: string; handle: string}): AuthResult {
    const normalEmail = input.email.toLowerCase()
    if (this.state.accounts.some(account => account.email === normalEmail)) {
      throw new Error('Email already exists.')
    }
    if (this.state.profiles.some(profile => profile.handle === input.handle)) {
      throw new Error('Handle already exists.')
    }
    const account: LocalAccountRecord = {
      id: parseAccountId(`account-${input.handle.replace(/[^a-z0-9-]/gi, '-')}`),
      email: normalEmail,
      displayName: input.displayName,
      createdAt: this.clock.iso(),
      approvedDemo: true,
    }
    const profile: LocalProfileRecord = {
      ...clone(this.state.profiles[0]),
      id: parseProfileId(`profile-${input.handle.replace(/[^a-z0-9-]/gi, '-')}`),
      accountId: account.id,
      handle: input.handle,
      displayName: input.displayName,
      bio: 'Building a local Modula prototype profile.',
      followerCount: 0,
      followingCount: 0,
      moduleCount: 0,
      postCount: 0,
      isFollowing: false,
      followsViewer: false,
    }
    this.state.accounts.push(account)
    this.state.profiles.push(profile)
    return this.createSessionForAccount(account)
  }

  refreshSession(refreshToken: RefreshToken): AuthResult | null {
    const session = this.state.sessions.find(item => item.refreshToken === refreshToken && !item.revoked)
    if (!session || Date.parse(session.refreshTokenExpiresAt) <= Date.now()) return null
    const account = this.state.accounts.find(item => item.id === session.accountId)
    if (!account) return null
    const tokens = this.tokenIssuer.issue({sessionId: session.id, accountId: account.id})
    session.accessToken = tokens.accessToken
    session.refreshToken = tokens.refreshToken
    session.accessTokenExpiresAt = tokens.accessTokenExpiresAt
    return {
      session: this.sessionPayload(session),
      tokens,
    }
  }

  getSessionByAccessToken(accessToken: string, expiryEnabled: boolean): AuthResult['session'] | null {
    const session = this.state.sessions.find(item => item.accessToken === accessToken && !item.revoked)
    if (!session) return null
    if (expiryEnabled && Date.parse(session.accessTokenExpiresAt) <= Date.now()) return null
    return this.sessionPayload(session)
  }

  revokeSession(refreshToken: RefreshToken | null): void {
    if (!refreshToken) return
    this.state.sessions = this.state.sessions.map(session =>
      session.refreshToken === refreshToken ? {...session, revoked: true} : session,
    )
  }

  expireAccessToken(): void {
    this.state.sessions = this.state.sessions.map(session => ({
      ...session,
      accessTokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
    }))
  }

  invalidateRefreshToken(): void {
    this.state.sessions = this.state.sessions.map(session => ({
      ...session,
      refreshTokenExpiresAt: new Date(Date.now() - 1000).toISOString(),
    }))
  }

  updateOwnerProfile(input: UpdateProfileInput): ModulaProfile {
    const accountId = parseAccountId('account-andrei')
    const index = this.state.profiles.findIndex(profile => profile.accountId === accountId)
    if (index < 0) throw new Error('Owner profile not found.')
    const current = this.state.profiles[index]
    const next: LocalProfileRecord = {
      ...current,
      ...input,
      avatarUri: input.avatarUri === null ? undefined : input.avatarUri ?? current.avatarUri,
      coverUri: input.coverUri === null ? undefined : input.coverUri ?? current.coverUri,
      location: input.location === null ? undefined : input.location ?? current.location,
      website: input.website === null ? undefined : input.website ?? current.website,
      focusStatus: input.focusStatus ?? current.focusStatus,
    }
    this.state.profiles[index] = next
    this.state.posts = this.state.posts.map(post =>
      post.author.id === current.id ? {...post, author: this.withRelationship(next)} : post,
    )
    return this.withRelationship(next)
  }

  private createSessionForAccount(account: LocalAccountRecord): AuthResult {
    const id = parseSessionId(`session-${Date.now().toString(36)}-${Math.round(Math.random() * 9999)}`)
    const tokens = this.tokenIssuer.issue({sessionId: id, accountId: account.id})
    const session: LocalSessionRecord = {
      id,
      accountId: account.id,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      refreshTokenExpiresAt: this.clock.daysFromNow(30),
      revoked: false,
    }
    this.state.sessions.push(session)
    return {
      session: this.sessionPayload(session),
      tokens,
    }
  }

  private sessionPayload(session: LocalSessionRecord): AuthResult['session'] {
    const account = this.state.accounts.find(item => item.id === session.accountId)
    if (!account) throw new Error('Account not found.')
    return {
      status: 'signedIn',
      sessionId: session.id,
      account: clone(account),
      profile: this.getOwnerProfile(account.id),
      accessTokenExpiresAt: session.accessTokenExpiresAt,
    }
  }

  private ownerProfileId(): ProfileId {
    return parseProfileId('profile-andrei')
  }

  private decoratePosts(posts: SocialPost[]): SocialPost[] {
    return posts.map(post => this.decoratePost(post))
  }

  private decoratePost(post: SocialPost): SocialPost {
    const profile = this.getProfileById(post.author.id as ProfileId) ?? post.author
    const liked = this.state.likes.some(item => item.postId === post.id)
    const saved = this.state.saves.some(item => item.postId === post.id)
    const reposted = this.state.reposts.some(item => item.postId === post.id)
    return clone({
      ...post,
      author: profile,
      liked,
      saved,
      reposted,
      likeCount: Math.max(0, post.likeCount + (liked && !post.liked ? 1 : 0)),
      repostCount: Math.max(0, post.repostCount + (reposted && !post.reposted ? 1 : 0)),
    } as SocialPost)
  }

  private toggleEdge(edge: 'likes' | 'saves' | 'reposts', postId: PostId, selected: boolean) {
    const profileId = this.ownerProfileId()
    const exists = this.state[edge].some(item => item.profileId === profileId && item.postId === postId)
    if (selected && !exists) this.state[edge].push({profileId, postId} as never)
    if (!selected) {
      this.state[edge] = this.state[edge].filter(item => !(item.profileId === profileId && item.postId === postId)) as never
    }
  }

  private updatePostEngagement(postId: PostId): PostEngagement {
    const post = this.getPost(postId)
    if (!post) throw new Error('Post not found.')
    return {
      liked: post.liked,
      saved: post.saved,
      reposted: post.reposted,
      likeCount: post.likeCount,
      replyCount: post.replyCount,
      repostCount: post.repostCount,
    }
  }

  private updateProfileFollowState(profileId: ProfileId): FollowResult {
    const profile = this.getProfileById(profileId)
    if (!profile) throw new Error('Profile not found.')
    const isFollowing = this.state.follows.some(item => item.followerProfileId === this.ownerProfileId() && item.followingProfileId === profileId)
    const followerCount = this.state.follows.filter(item => item.followingProfileId === profileId).length
    return {
      profile: {...profile, isFollowing, followerCount},
      isFollowing,
      followerCount,
    }
  }

  private withRelationship(profile: LocalProfileRecord): ModulaProfile {
    const owner = this.ownerProfileId()
    const profileId = profile.id as ProfileId
    const isFollowing = this.state.follows.some(item => item.followerProfileId === owner && item.followingProfileId === profileId)
    const followsViewer = this.state.follows.some(item => item.followerProfileId === profileId && item.followingProfileId === owner)
    const followerCount = Math.max(profile.followerCount, this.state.follows.filter(item => item.followingProfileId === profileId).length)
    const followingCount = Math.max(profile.followingCount, this.state.follows.filter(item => item.followerProfileId === profileId).length)
    return clone({
      ...profile,
      isFollowing,
      followsViewer,
      followerCount,
      followingCount,
    })
  }
}
