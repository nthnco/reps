import type { ActivityRead } from './api/generated'

// The server's window (WEEKS in backend/app/activity.py); shorter grids are its tail.
const WINDOW_WEEKS = 26

export type Level = 0 | 1 | 2 | 3 | 4
export type Cell = { day: string; count: number; level: Level }
/** One grid column, Sunday first. `month` is the label drawn above it, if any. */
export type Week = { cells: Cell[]; month: string | null }

// 'YYYY-MM-DD' parses as UTC midnight; stepping in UTC keeps the browser's
// timezone and DST from shifting a day.
function addDays(isoDate: string, days: number): string {
  const date = new Date(isoDate)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function monthOf(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
}

/** The last `weeks` columns (at most 26) of the activity window, ending in today's week. */
export function buildWeeks(activity: ActivityRead, weeks: number): Week[] {
  const counts = new Map(activity.days.map(({ day, count }) => [day, count]))
  const firstSunday = addDays(activity.start, 7 * (WINDOW_WEEKS - weeks))

  const columns: Week[] = []
  for (let w = 0; w < weeks; w++) {
    const sunday = addDays(firstSunday, 7 * w)
    const cells: Cell[] = []
    for (let d = 0; d < 7; d++) {
      const day = addDays(sunday, d)
      if (day > activity.today) break // ISO dates compare correctly as strings
      const count = counts.get(day) ?? 0
      cells.push({ day, count, level: Math.min(count, 4) as Level })
    }
    columns.push({ cells, month: null })
  }

  // Label a column when its Sunday starts a new month. The first column keeps
  // its label unless the second starts a month too: the two would overlap.
  columns.forEach((column, w) => {
    const month = monthOf(column.cells[0].day)
    const previous = w > 0 ? monthOf(columns[w - 1].cells[0].day) : null
    if (month !== previous) column.month = month
  })
  if (columns.length > 1 && columns[1].month !== null) columns[0].month = null

  return columns
}
