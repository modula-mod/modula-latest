import {Alert} from 'react-native'

import {captureMediaFromSource} from '@/platform/ui/camera'
import type {MediaCaptureTarget} from '@/platform/ui/camera/types'
import type {ModulaActionItem} from '@/platform/ui/menus/types'

export function profilePhotoMenuActions(options: {
  hasPhoto: boolean
  removeLabel: string
}): ModulaActionItem[] {
  const actions: ModulaActionItem[] = [
    {id: 'library', label: 'Choose Photo', icon: 'photo'},
    {id: 'camera', label: 'Take Photo', icon: 'camera'},
  ]
  if (options.hasPhoto) {
    actions.push({
      id: 'remove',
      label: options.removeLabel,
      icon: 'trash',
      style: 'destructive',
    })
  }
  return actions
}

export async function applyProfilePhotoMenuAction(options: {
  actionId: string
  target: MediaCaptureTarget
  onUri: (uri: string) => void
  onRemove: () => void
}): Promise<void> {
  if (options.actionId === 'remove') {
    options.onRemove()
    return
  }
  if (options.actionId !== 'library' && options.actionId !== 'camera') return

  const result = await captureMediaFromSource(options.actionId, {target: options.target})
  if (result.ok) {
    options.onUri(result.asset.uri)
    return
  }
  if (result.reason === 'cancelled') return
  Alert.alert(
    options.actionId === 'camera' ? 'Camera unavailable' : 'Photo unavailable',
    result.message,
  )
}
