export class LocalApiClock {
  now(): Date {
    return new Date()
  }

  iso(): string {
    return this.now().toISOString()
  }

  minutesFromNow(minutes: number): string {
    return new Date(this.now().getTime() + minutes * 60_000).toISOString()
  }

  daysFromNow(days: number): string {
    return new Date(this.now().getTime() + days * 86_400_000).toISOString()
  }
}
