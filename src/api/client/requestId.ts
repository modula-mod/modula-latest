let counter = 0

export function createRequestId(): string {
  counter += 1
  return `local_req_${Date.now()}_${counter}`
}
