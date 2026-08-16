import {presentModulaActions} from '@/platform/ui/menus/presentModulaActions'
import type {ModulaActionItem} from '@/platform/ui/menus/types'
import {captureMediaFromSource} from '@/platform/ui/camera/mediaCapture'
import type {
  MediaCaptureOptions,
  MediaCaptureResult,
  MediaCaptureSource,
} from '@/platform/ui/camera/types'
import {lightImpactHaptic} from '@/lib/haptics'

export type PresentMediaSourceMenuOptions = MediaCaptureOptions & {
  title?: string
  message?: string
  includeRemove?: boolean
  removeLabel?: string
}

export type MediaSourceMenuResult =
  | MediaCaptureResult
  | {ok: false; reason: 'dismissed' | 'removed'; message: string; source: 'menu'}

/**
 * Native Choose Photo / Take Photo chooser — feels like system media chrome,
 * not a debug picker dump.
 */
export async function presentMediaSourceMenu(
  options: PresentMediaSourceMenuOptions,
): Promise<MediaSourceMenuResult> {
  const actions: ModulaActionItem[] = [
    {id: 'library', label: 'Choose Photo', icon: 'photo'},
    {id: 'camera', label: 'Take Photo', icon: 'camera'},
  ]

  if (options.includeRemove) {
    actions.push({
      id: 'remove',
      label: options.removeLabel ?? 'Remove Photo',
      icon: 'trash',
      style: 'destructive',
    })
  }

  const selected = await presentModulaActions({
    title: options.title ?? 'Photo',
    message: options.message ?? 'Photos stay on this device for this local session.',
    actions,
  })

  if (!selected) {
    return {
      ok: false,
      reason: 'dismissed',
      source: 'menu',
      message: 'Photo menu dismissed.',
    }
  }

  if (selected === 'remove') {
    void lightImpactHaptic()
    return {
      ok: false,
      reason: 'removed',
      source: 'menu',
      message: 'Photo removed.',
    }
  }

  void lightImpactHaptic()
  return captureMediaFromSource(selected as MediaCaptureSource, options)
}
