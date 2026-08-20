import type {SocialPost} from '@/domain/social'
import type {PostContent} from '@/features/social/posts/types/post'

/** Map existing SocialPost contract to declarative renderer content. */
export function resolvePostContent(post: SocialPost): PostContent {
  if (post.kind === 'text') {
    return {kind: 'text', body: post.text}
  }

  if (post.kind === 'link') {
    return {kind: 'link', preview: post.link}
  }

  if (post.kind === 'media') {
    const items = post.media ?? []
    const video = items.find(item => item.kind === 'video')
    if (video) {
      return {
        kind: 'video',
        source: video,
        aspectRatio: video.aspectRatio ?? 9 / 16,
      }
    }
    const images = items.filter(item => item.kind === 'image')
    if (images.length > 1) {
      return {
        kind: 'carousel',
        items: images,
        aspectRatio: images[0]?.aspectRatio ?? 4 / 5,
      }
    }
    const image = images[0] ?? items[0]
    return {
      kind: 'image',
      source: image,
      aspectRatio: image?.aspectRatio ?? 4 / 5,
      altText: image?.altText,
    }
  }

  if (post.kind === 'module') {
    return {
      kind: 'link',
      preview: {
        domain: 'modula.digital',
        title: post.module.name,
        description: post.module.status,
      },
    }
  }

  const _exhaustive: never = post
  return {kind: 'text', body: String(_exhaustive)}
}

export function defaultPostAspectRatio(content: PostContent): number {
  switch (content.kind) {
    case 'carousel':
      return content.aspectRatio ?? 4 / 5
    case 'image':
      return content.aspectRatio ?? content.source.aspectRatio ?? 4 / 5
    case 'video':
      return content.aspectRatio ?? content.source.aspectRatio ?? 9 / 16
    case 'movie':
      return content.source.aspectRatio ?? 9 / 16
    case 'music':
      return content.artwork.aspectRatio ?? 1
    case 'text':
      return 1.15
    case 'link':
    case 'poll':
    case 'event':
      return 4 / 5
  }
}
