import {useEffect, useMemo, useRef, useState} from 'react'

import type {ModulaSegmentedOption} from '@/platform/ui/controls/modula-segmented-picker.types'

type UseSegmentedVisibleOptionsArgs = {
  options: ModulaSegmentedOption[]
  value: string
  initialVisibleCount?: number
  revealBatchSize?: number
  autoRevealIntervalMs?: number
  onRevealMore?: (visibleCount: number) => void
}

/**
 * Progressive option window for the native segmented Picker.
 * Starts with a subset, then automatically loads more batches until complete.
 * Always expands far enough to include the current `value`.
 */
export function useSegmentedVisibleOptions({
  options,
  value,
  initialVisibleCount,
  revealBatchSize = 2,
  autoRevealIntervalMs = 700,
  onRevealMore,
}: UseSegmentedVisibleOptionsArgs) {
  const total = options.length
  const startCount = Math.min(
    Math.max(initialVisibleCount ?? total, 1),
    Math.max(total, 1),
  )
  const [visibleCount, setVisibleCount] = useState(startCount)
  const onRevealMoreRef = useRef(onRevealMore)
  onRevealMoreRef.current = onRevealMore

  // Reset window when the option list shrinks / identity changes meaningfully.
  useEffect(() => {
    setVisibleCount(Math.min(Math.max(initialVisibleCount ?? total, 1), total))
  }, [initialVisibleCount, total])

  // Keep the selected value inside the visible window.
  useEffect(() => {
    const index = options.findIndex(option => option.value === value)
    if (index < 0) return
    const need = index + 1
    setVisibleCount(count => (count < need ? need : count))
  }, [options, value])

  // Automatically load more batches until everything is shown.
  useEffect(() => {
    if (visibleCount >= total) return
    if (autoRevealIntervalMs <= 0) {
      setVisibleCount(total)
      return
    }
    const timer = setTimeout(() => {
      setVisibleCount(count => {
        if (count >= total) return count
        const next = Math.min(total, count + Math.max(1, revealBatchSize))
        onRevealMoreRef.current?.(next)
        return next
      })
    }, autoRevealIntervalMs)
    return () => clearTimeout(timer)
  }, [autoRevealIntervalMs, revealBatchSize, total, visibleCount])

  const visibleOptions = useMemo(
    () => options.slice(0, Math.min(visibleCount, total)),
    [options, total, visibleCount],
  )

  const revealMoreNow = () => {
    setVisibleCount(count => {
      if (count >= total) return count
      const next = Math.min(total, count + Math.max(1, revealBatchSize))
      onRevealMoreRef.current?.(next)
      return next
    })
  }

  return {
    visibleOptions,
    visibleCount: Math.min(visibleCount, total),
    hasMore: visibleCount < total,
    revealMoreNow,
  }
}
