import type {PostContent} from '@/features/social/posts/types/post'
import {CarouselPostRenderer} from '@/features/social/posts/renderers/carousel-post-renderer'
import {ImagePostRenderer} from '@/features/social/posts/renderers/image-post-renderer'
import {LinkPostRenderer} from '@/features/social/posts/renderers/link-post-renderer'
import {MusicPostRenderer} from '@/features/social/posts/renderers/music-post-renderer'
import {PollPostRenderer} from '@/features/social/posts/renderers/poll-post-renderer'
import {TextPostRenderer} from '@/features/social/posts/renderers/text-post-renderer'
import {VideoPostRenderer} from '@/features/social/posts/renderers/video-post-renderer'

type PostContentRendererProps = {
  content: PostContent
  active?: boolean
  onDoubleTapLike: () => void
  layout?: 'fill' | 'flow'
}

export function PostContentRenderer({
  content,
  active,
  onDoubleTapLike,
  layout = 'fill',
}: PostContentRendererProps) {
  switch (content.kind) {
    case 'image':
      return <ImagePostRenderer content={content} onDoubleTapLike={onDoubleTapLike} />
    case 'text':
      return <TextPostRenderer content={content} layout={layout} />
    case 'link':
      return <LinkPostRenderer content={content} />
    case 'poll':
      return <PollPostRenderer content={content} />
    case 'carousel':
      return <CarouselPostRenderer content={content} />
    case 'video':
      return <VideoPostRenderer content={content} active={active} />
    case 'music':
      return <MusicPostRenderer content={content} />
    default:
      return null
  }
}
