export function satisfiesMinimumVersion(version: string, minimum?: string): boolean {
  if (!minimum) return true
  const current = parseSemver(version)
  const required = parseSemver(minimum)
  if (!current || !required) return version === minimum
  for (let index = 0; index < 3; index += 1) {
    const left = current[index] ?? 0
    const right = required[index] ?? 0
    if (left > right) return true
    if (left < right) return false
  }
  return true
}

function parseSemver(value: string): [number, number, number] | null {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}
