import type {ModulaActionItem} from '@/platform/ui/menus'
import type {SocialPost} from '@/domain/social'

export type PostOverflowActionId =
  | 'translate'
  | 'copyText'
  | 'copyLink'
  | 'share'
  | 'saveToVault'
  | 'quote'
  | 'viewEngagement'
  | 'openInBrowser'
  | 'mute'
  | 'hide'
  | 'report'

export type PostOverflowAction = ModulaActionItem & {
  id: PostOverflowActionId
}

/**
 * Overflow / More catalog — keeps engagement row lean.
 * Reply / Repost / Like / Share / Save stay on the row; extras live here.
 */
export function buildPostOverflowActions(post: SocialPost): PostOverflowAction[] {
  const hasText = Boolean(post.text?.trim())
  const hasLink = post.kind === 'link'

  const actions: PostOverflowAction[] = [
    {
      id: 'translate',
      label: 'Translate (Preview)',
      accessibilityLabel: 'Translate post',
      disabled: !hasText,
    },
    {
      id: 'copyText',
      label: 'Copy text',
      accessibilityLabel: 'Copy post text',
      disabled: !hasText,
    },
    {
      id: 'copyLink',
      label: 'Copy link',
      accessibilityLabel: 'Copy post link',
    },
    {
      id: 'share',
      label: 'Share',
      accessibilityLabel: 'Share post',
    },
    {
      id: 'saveToVault',
      label: 'Save to Vault',
      accessibilityLabel: 'Save post to Vault',
    },
    {
      id: 'quote',
      label: 'Quote (Preview)',
      accessibilityLabel: 'Quote post preview',
    },
    {
      id: 'viewEngagement',
      label: 'View engagement (Preview)',
      accessibilityLabel: 'View post engagement preview',
    },
  ]

  if (hasLink) {
    actions.push({
      id: 'openInBrowser',
      label: 'Open in browser',
      accessibilityLabel: 'Open post link in browser',
    })
  }

  actions.push(
    {
      id: 'mute',
      label: 'Mute (Preview)',
      accessibilityLabel: 'Mute author preview',
    },
    {
      id: 'hide',
      label: 'Hide post (Preview)',
      accessibilityLabel: 'Hide post preview',
    },
    {
      id: 'report',
      label: 'Report (Preview)',
      accessibilityLabel: 'Report post preview',
      style: 'destructive',
    },
  )

  return actions.filter(action => !action.disabled)
}

export function getPostPermalink(post: SocialPost): string {
  return `https://modula.digital/post/${post.id}`
}

export function inferPostLinkUrl(domain: string): string {
  const trimmed = domain.trim()
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed.replace(/^\/+/, '')}`
}

export function getPostShareMessage(post: SocialPost): string {
  const author = `${post.author.displayName} (@${post.author.handle})`
  const body = post.text?.trim()
  const link = getPostPermalink(post)
  if (body) return `${author}\n${body}\n${link}`
  return `${author}\n${link}`
}
