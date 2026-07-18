export {captureMediaFromSource} from '@/platform/ui/camera/mediaCapture'
export {presentMediaSourceMenu} from '@/platform/ui/camera/presentMediaSourceMenu'
export type {PresentMediaSourceMenuOptions, MediaSourceMenuResult} from '@/platform/ui/camera/presentMediaSourceMenu'
export type {
  MediaCaptureOptions,
  MediaCaptureResult,
  MediaCaptureSource,
  MediaCaptureTarget,
} from '@/platform/ui/camera/types'
// Permission hook: import from `@/platform/ui/camera/useModulaCameraPermission`
// (kept out of this barrel so media-capture imports stay free of expo-camera).
