import {Preloader, Progressbar} from 'konsta/react'

export function KonstaProgress({
  label,
  progress,
  testID,
}: {
  label?: string
  progress?: number
  testID?: string
}) {
  if (progress == null) {
    return (
      <Preloader
        aria-label={label ?? 'Loading'}
        className="modula-konsta-preloader"
        data-testid={testID}
        role="progressbar"
      />
    )
  }
  const clamped = Math.max(0, Math.min(1, progress))
  return (
    <Progressbar
      aria-label={label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(clamped * 100)}
      className="modula-konsta-progress"
      data-testid={testID}
      progress={clamped}
      role="progressbar"
    />
  )
}
