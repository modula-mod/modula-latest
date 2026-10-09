import {permanentModuleJob} from './module-job-errors.js'

export function assertPermissionReviewPresent(review: {review_id: string} | undefined): void {
  if (!review) throw permanentModuleJob('PERMISSION_REVIEW_REQUIRED', 'Module permission review is required before this executable transition')
}
