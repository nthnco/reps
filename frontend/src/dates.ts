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
