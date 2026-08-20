import {AppText} from '@/components/primitives/AppText'
import {formatCompactCount} from '@/features/social/posts/types/post'

type PostCounterProps = {
  value: number
  selected?: boolean
  overlay?: boolean
}

export function PostCounter({value, selected, overlay}: PostCounterProps) {
  if (value <= 0) return null
  return (
    <AppText
      variant="caption"
      style={{
        color: overlay
          ? selected
            ? '#FF6B6B'
            : 'rgba(255,255,255,0.86)'
          : undefined,
        fontSize: 11,
        fontVariant: ['tabular-nums'],
        marginTop: 2,
        textAlign: 'center',
      }}
      colour={overlay ? undefined : selected ? 'accent' : 'textSecondary'}>
      {formatCompactCount(value)}
    </AppText>
  )
}
