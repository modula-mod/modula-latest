import type {ImagePickerAsset} from 'expo-image-picker'

export type MediaCaptureSource = 'library' | 'camera'

export type MediaCaptureTarget = 'composer' | 'avatar' | 'cover' | 'generic'

export type MediaCaptureResult =
  | {ok: true; asset: ImagePickerAsset; source: MediaCaptureSource}
  | {
      ok: false
      reason: 'cancelled' | 'permission' | 'unavailable' | 'empty'
      message: string
      source: MediaCaptureSource
    }

export type MediaCaptureOptions = {
  target: MediaCaptureTarget
  allowsEditing?: boolean
  aspect?: [number, number]
  quality?: number
}
