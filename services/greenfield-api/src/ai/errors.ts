export function statusForAiError(code: string): number {
  if (code === 'AI_ACTION_NOT_DECLARED') return 404
  if (code === 'AI_ACTION_PERMISSION_REQUIRED' || code === 'AI_CONTEXT_PERMISSION_REQUIRED' || code === 'AI_RESULT_OWNERSHIP_MISMATCH') return 403
  if (code === 'AI_RESULT_ALREADY_APPLIED') return 409
  if (code === 'AI_PROVIDER_AUTH_FAILED' || code === 'AI_CAPABILITY_UNAVAILABLE') return 403
  if (code === 'AI_QUOTA_EXCEEDED' || code === 'AI_PROVIDER_RATE_LIMITED') return 429
  if (code === 'AI_MODEL_UNAVAILABLE' || code === 'AI_PROVIDER_UNAVAILABLE') return 503
  if (code === 'AI_PROVIDER_TIMEOUT') return 504
  if (code === 'AI_EXECUTION_CANCELLED') return 409
  return 400
}
