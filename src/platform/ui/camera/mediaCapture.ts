import * as ImagePicker from 'expo-image-picker'

import type {
  MediaCaptureOptions,
  MediaCaptureResult,
  MediaCaptureSource,
} from '@/platform/ui/camera/types'

const DEFAULT_QUALITY = 0.88

function editingForTarget(target: MediaCaptureOptions['target']): {
  allowsEditing: boolean
  aspect?: [number, number]
} {
  switch (target) {
    case 'avatar':
      return {allowsEditing: true, aspect: [1, 1]}
    case 'cover':
      return {allowsEditing: true, aspect: [3, 1]}
    case 'composer':
    case 'generic':
    default:
      return {allowsEditing: false}
  }
}

/**
 * Polished ImagePicker / camera presentation for profile + composer media.
 * Local/session only — no remote upload claim.
 */
export async function captureMediaFromSource(
  source: MediaCaptureSource,
  options: MediaCaptureOptions,
): Promise<MediaCaptureResult> {
  const editing = editingForTarget(options.target)
  const allowsEditing = options.allowsEditing ?? editing.allowsEditing
  const aspect = options.aspect ?? editing.aspect
  const quality = options.quality ?? DEFAULT_QUALITY

  try {
    if (source === 'library') {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (!permission.granted) {
        return {
          ok: false,
          reason: 'permission',
          source,
          message:
            'Photo access was not granted. You can try again from Settings, or continue without a new photo.',
        }
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing,
        aspect,
        quality,
        exif: false,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
      })

      return mapPickerResult(result, source)
    }

    const permission = await ImagePicker.requestCameraPermissionsAsync()
    if (!permission.granted) {
      return {
        ok: false,
        reason: 'permission',
        source,
        message:
          'Camera access was not granted. You can choose a library photo instead.',
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing,
      aspect,
      quality,
      exif: false,
      cameraType: ImagePicker.CameraType.back,
      presentationStyle: ImagePicker.UIImagePickerPresentationStyle.FULL_SCREEN,
    })

    return mapPickerResult(result, source)
  } catch {
    return {
      ok: false,
      reason: 'unavailable',
      source,
      message:
        source === 'camera'
          ? 'Camera capture is unavailable in this environment.'
          : 'Photo selection is unavailable in this environment.',
    }
  }
}

function mapPickerResult(
  result: ImagePicker.ImagePickerResult,
  source: MediaCaptureSource,
): MediaCaptureResult {
  if (result.canceled) {
    return {
      ok: false,
      reason: 'cancelled',
      source,
      message: 'Photo selection was cancelled.',
    }
  }

  const asset = result.assets[0]
  if (!asset?.uri) {
    return {
      ok: false,
      reason: 'empty',
      source,
      message: 'No photo was returned. Please try again.',
    }
  }

  return {ok: true, asset, source}
}
