/** 0.724 -> 72. Mastery values arrive as 0-1 floats. */
export function toPercent(fraction: number): number {
  return Math.round(fraction * 100)
}

/** 1100 -> "18 min". Never "0 min": anything timed shows as at least 1. */
export function formatMinutes(seconds: number): string {
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

/** plural(1, 'attempt') -> "1 attempt", plural(3, 'attempt') -> "3 attempts". */
export function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}
