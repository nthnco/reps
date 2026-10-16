/** Whole days from one ISO date to another; negative if `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  // Both parse as midnight UTC, so the difference is an exact multiple of a day.
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000)
}

/** "2026-10-03" -> "Oct 3", without letting the browser's timezone shift the day. */
export function formatDueDate(isoDate: string): string {
  // new Date('2026-10-03') is midnight UTC, which is still Oct 2 in Los Angeles,
  // so format it in UTC too.
  return new Date(isoDate).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}
