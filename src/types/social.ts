export type DemoProfile = {
  id: string
  displayName: string
  handle: string
  bio: string
  avatarColour: string
  moduleCount: number
  followingCount: number
  followerCount: number
}

export type DemoMedia = {
  id: string
  kind: 'image'
  title: string
  uri?: string
  colour: string
  aspectRatio: number
}

export type BasePost = {
  id: string
  author: DemoProfile
  createdAt: string
  feed: 'following' | 'forYou' | 'modules'
  liked: boolean
  saved: boolean
  reposted: boolean
  likeCount: number
  replyCount: number
  repostCount: number
}

export type TextPost = BasePost & {
  kind: 'text'
  text: string
}

export type MediaPost = BasePost & {
  kind: 'media'
  text?: string
  media: DemoMedia[]
  glowColour: string
}

export type LinkPost = BasePost & {
  kind: 'link'
  text?: string
  link: {
    domain: string
    title: string
    description: string
    image?: string
  }
}

export type ModulePost = BasePost & {
  kind: 'module'
  text?: string
  module: {
    name: string
    actionLabel: string
    status: string
  }
}

export type DemoPost = TextPost | MediaPost | LinkPost | ModulePost

export type CreateDemoPostInput = {
  text?: string
  media?: DemoMedia[]
  link?: LinkPost['link']
  poll?: {
    question: string
    options: string[]
  }
}
